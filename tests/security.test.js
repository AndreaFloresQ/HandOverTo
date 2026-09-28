const request = require('supertest');
const path = require('path');
const app = require('../src/app');
const { User } = require('../src/models');
const {
  crearUsuario,
  generarToken,
  crearBeneficiario,
  limpiarDatosDePrueba,
} = require('./helpers');

const imagenPrueba = path.join(__dirname, 'fixtures', 'producto.jpg');

describe('Seguridad', () => {
  let tokenAdmin;
  let tokenDonador;

  beforeAll(async () => {
    tokenAdmin = generarToken(await crearUsuario({ rol: 'admin' }));
    tokenDonador = generarToken(await crearUsuario({ rol: 'donador' }));
  });

  afterAll(async () => {
    await limpiarDatosDePrueba();
  });

  describe('Cabeceras HTTP', () => {
    it('no expone la tecnología del servidor (X-Powered-By)', async () => {
      const respuesta = await request(app).get('/api/health');
      expect(respuesta.headers['x-powered-by']).toBeUndefined();
    });

    it('envía las cabeceras de seguridad en el frontend', async () => {
      const respuesta = await request(app).get('/');
      expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
      expect(respuesta.headers['content-security-policy']).toContain("default-src 'self'");
      expect(respuesta.headers['x-frame-options']).toBeDefined();
      expect(respuesta.headers['permissions-policy']).toBeDefined();
    });

    it('no habilita CORS para orígenes externos', async () => {
      const respuesta = await request(app).get('/api/health').set('Origin', 'http://sitio-malicioso.com');
      expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('evita que las respuestas de la API se guarden en caché', async () => {
      const respuesta = await request(app).get('/api/health');
      expect(respuesta.headers['cache-control']).toBe('no-store');
    });

    it('responde 404 en JSON para rutas inexistentes', async () => {
      const respuesta = await request(app).get('/api/no-existe');
      expect(respuesta.status).toBe(404);
      expect(respuesta.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Inyección SQL', () => {
    it('no permite iniciar sesión con un payload SQL clásico', async () => {
      const respuesta = await request(app)
        .post('/api/auth/login')
        .send({ correo: "' OR '1'='1", password: "' OR '1'='1" });

      expect(respuesta.status).toBe(401);
    });

    it('trata un payload SQL en el filtro de estado como texto, sin devolver datos extra', async () => {
      const respuesta = await request(app)
        .get("/api/admin/donations?estado=' OR '1'='1")
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual([]);
    });
  });

  describe('XSS', () => {
    it('devuelve etiquetas HTML como texto JSON, nunca como HTML', async () => {
      const payload = '<img src=x onerror=alert(1)>';
      const correo = `test-xss-${Date.now()}@test.com`;

      const respuesta = await request(app).post('/api/auth/register').send({
        nombre: payload,
        direccion: 'Calle 1',
        ciudad: 'Ciudad',
        telefono: '5551234567',
        correo,
        password: 'MiClave123',
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.headers['content-type']).toMatch(/application\/json/);
      expect(respuesta.body.usuario.nombre).toBe(payload);

      await User.destroy({ where: { correo } });
    });
  });

    describe('Peticiones sin cuerpo', () => {
    it('responde 400 (no 500) al registrar sin cuerpo', async () => {
      const respuesta = await request(app).post('/api/auth/register');
      expect(respuesta.status).toBe(400);
    });

    it('responde 400 (no 500) al iniciar sesión sin cuerpo', async () => {
      const respuesta = await request(app).post('/api/auth/login');
      expect(respuesta.status).toBe(400);
    });

    it('responde 400 (no 500) al crear un beneficiario sin cuerpo', async () => {
      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(respuesta.status).toBe(400);
    });

    it('responde 400 (no 500) al crear una donación sin formulario multipart', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`);
      expect(respuesta.status).toBe(400);
    });
  });

  describe('Validación de entradas (donaciones)', () => {
    const donacionBase = (req) =>
      req
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'Prueba')
        .field('categoria', 'alimentos')
        .attach('imagen', imagenPrueba);

    it('rechaza una cantidad que no es número', async () => {
      const respuesta = await donacionBase(request(app)).field('cantidad', '%s%s%s').field('peso', '5');
      expect(respuesta.status).toBe(400);
    });

    it('rechaza un peso negativo', async () => {
      const respuesta = await donacionBase(request(app)).field('cantidad', '1').field('peso', '-5');
      expect(respuesta.status).toBe(400);
    });

    it('rechaza un beneficiario que no es numérico', async () => {
      const respuesta = await donacionBase(request(app))
        .field('cantidad', '1')
        .field('peso', '5')
        .field('beneficiarioId', 'abc');
      expect(respuesta.status).toBe(400);
    });

    it('rechaza una fecha de caducidad con formato inválido', async () => {
      const respuesta = await donacionBase(request(app))
        .field('cantidad', '1')
        .field('peso', '5')
        .field('perecedero', 'true')
        .field('fechaCaducidad', 'mañana');
      expect(respuesta.status).toBe(400);
    });

    it('rechaza un nombre de producto demasiado largo', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'a'.repeat(300))
        .field('categoria', 'alimentos')
        .field('cantidad', '1')
        .field('peso', '5')
        .attach('imagen', imagenPrueba);
      expect(respuesta.status).toBe(400);
    });
  });

  describe('Validación de entradas (beneficiarios)', () => {
    const beneficiarioValido = () => ({
      nombre: 'Beneficiario Seguridad',
      razonSocial: 'Seguridad A.C.',
      rfc: 'SEG010101AAA',
      direccion: 'Calle 1',
      telefono: '5550001111',
      encargado: 'Encargado',
      categorias: ['alimentos'],
    });

    it('rechaza un campo que no es texto', async () => {
      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...beneficiarioValido(), nombre: { $gt: '' } });
      expect(respuesta.status).toBe(400);
    });

    it('rechaza un campo con más de 255 caracteres', async () => {
      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...beneficiarioValido(), direccion: 'x'.repeat(300) });
      expect(respuesta.status).toBe(400);
    });

    it('rechaza actualizar con un campo inválido', async () => {
      const beneficiario = await crearBeneficiario();
      const respuesta = await request(app)
        .put(`/api/admin/beneficiaries/${beneficiario.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ telefono: 12345 });
      expect(respuesta.status).toBe(400);
    });

    it('rechaza actualizar dejando al beneficiario sin categorías', async () => {
      const beneficiario = await crearBeneficiario();
      const respuesta = await request(app)
        .put(`/api/admin/beneficiaries/${beneficiario.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ categorias: [] });
      expect(respuesta.status).toBe(400);
    });
  });
});