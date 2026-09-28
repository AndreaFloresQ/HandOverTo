const request = require('supertest');
const app = require('../src/app');
const { crearUsuario, generarToken, limpiarDatosDePrueba } = require('./helpers');

describe('Autenticación y roles', () => {
  afterAll(async () => {
    await limpiarDatosDePrueba();
   });

  const datosRegistro = () => ({
    nombre: 'Ana Torres',
    direccion: 'Calle Reforma 123',
    ciudad: 'Ciudad de prueba',
    telefono: '5551234567',
    correo: `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'MiClave123',
  });

  describe('POST /api/auth/register', () => {
    it('registra un donador correctamente', async () => {
      const respuesta = await request(app).post('/api/auth/register').send(datosRegistro());

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.usuario.rol).toBe('donador');
      expect(respuesta.body.usuario).not.toHaveProperty('password');
    });

    it('rechaza un correo ya registrado', async () => {
      const datos = datosRegistro();
      await request(app).post('/api/auth/register').send(datos);

      const respuesta = await request(app).post('/api/auth/register').send(datos);

      expect(respuesta.status).toBe(409);
    });

    it('rechaza una contraseña menor a 8 caracteres', async () => {
      const respuesta = await request(app)
        .post('/api/auth/register')
        .send({ ...datosRegistro(), password: '123' });

      expect(respuesta.status).toBe(400);
    });

    it('rechaza el registro si faltan campos obligatorios', async () => {
      const respuesta = await request(app)
        .post('/api/auth/register')
        .send({ correo: 'incompleto@test.com', password: 'MiClave123' });

      expect(respuesta.status).toBe(400);
    });

    it('ignora un rol "admin" enviado en el cuerpo de la petición', async () => {
      const respuesta = await request(app)
        .post('/api/auth/register')
        .send({ ...datosRegistro(), rol: 'admin' });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.usuario.rol).toBe('donador');
    });
  });

  describe('POST /api/auth/login', () => {
    it('inicia sesión con credenciales correctas y devuelve un token', async () => {
      const datos = datosRegistro();
      await request(app).post('/api/auth/register').send(datos);

      const respuesta = await request(app)
        .post('/api/auth/login')
        .send({ correo: datos.correo, password: datos.password });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveProperty('token');
      expect(respuesta.body.usuario.correo).toBe(datos.correo);
    });

    it('rechaza una contraseña incorrecta', async () => {
      const datos = datosRegistro();
      await request(app).post('/api/auth/register').send(datos);

      const respuesta = await request(app)
        .post('/api/auth/login')
        .send({ correo: datos.correo, password: 'ClaveIncorrecta' });

      expect(respuesta.status).toBe(401);
    });

    it('rechaza un correo que no existe', async () => {
      const respuesta = await request(app)
        .post('/api/auth/login')
        .send({ correo: 'noexiste@test.com', password: 'MiClave123' });

      expect(respuesta.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rechaza la petición sin token', async () => {
      const respuesta = await request(app).get('/api/auth/me');
      expect(respuesta.status).toBe(401);
    });

    it('rechaza un token inválido', async () => {
      const respuesta = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token-falso');
      expect(respuesta.status).toBe(401);
    });

    it('devuelve los datos del usuario autenticado', async () => {
      const usuario = await crearUsuario({ rol: 'donador' });
      const token = generarToken(usuario);

      const respuesta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.id).toBe(usuario.id);
      expect(respuesta.body).not.toHaveProperty('password');
    });
  });

  describe('Protección de rutas por rol', () => {
    it('permite a un admin acceder a /api/admin/ping', async () => {
      const admin = await crearUsuario({ rol: 'admin' });
      const token = generarToken(admin);

      const respuesta = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(200);
    });

    it('rechaza a un donador en /api/admin/ping (403)', async () => {
      const donador = await crearUsuario({ rol: 'donador' });
      const token = generarToken(donador);

      const respuesta = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(403);
    });

    it('rechaza a un admin en /api/donador/ping (403)', async () => {
      const admin = await crearUsuario({ rol: 'admin' });
      const token = generarToken(admin);

      const respuesta = await request(app).get('/api/donador/ping').set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(403);
    });
  });
});