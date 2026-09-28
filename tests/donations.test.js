const request = require('supertest');
const path = require('path');
const app = require('../src/app');
const {
  crearUsuario,
  generarToken,
  crearBeneficiario,
  limpiarDatosDePrueba,
} = require('./helpers');

// Imagen mínima de prueba para las peticiones que suben archivo
const imagenPrueba = path.join(__dirname, 'fixtures', 'producto.jpg');

describe('Donaciones (lado donador)', () => {
  let donador;
  let token;

  beforeAll(async () => {
    donador = await crearUsuario({ rol: 'donador' });
    token = generarToken(donador);
  });

  afterAll(async () => {
    await limpiarDatosDePrueba();
  });

  describe('POST /api/donations', () => {
    it('crea una donación con imagen', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${token}`)
        .field('producto', 'Despensa básica')
        .field('categoria', 'alimentos')
        .field('cantidad', 10)
        .field('peso', 15.5)
        .field('perecedero', 'false')
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.donacion.estado).toBe('pendiente');
      expect(respuesta.body.donacion.beneficiarioId).toBeNull();
    });

    it('rechaza la donación si falta la imagen', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${token}`)
        .field('producto', 'Sin imagen')
        .field('categoria', 'alimentos')
        .field('cantidad', 1)
        .field('peso', 1);

      expect(respuesta.status).toBe(400);
    });

    it('rechaza una categoría inválida', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${token}`)
        .field('producto', 'Categoría inválida')
        .field('categoria', 'juguetes')
        .field('cantidad', 1)
        .field('peso', 1)
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(400);
    });

    it('permite elegir un beneficiario al donar', async () => {
      const beneficiario = await crearBeneficiario();

      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${token}`)
        .field('producto', 'Con beneficiario')
        .field('categoria', 'alimentos')
        .field('cantidad', 2)
        .field('peso', 3)
        .field('beneficiarioId', beneficiario.id)
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.donacion.beneficiarioId).toBe(beneficiario.id);
    });

    it('rechaza un admin intentando crear una donación (403)', async () => {
      const admin = await crearUsuario({ rol: 'admin' });
      const tokenAdmin = generarToken(admin);

      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .field('producto', 'No permitido')
        .field('categoria', 'alimentos')
        .field('cantidad', 1)
        .field('peso', 1);

      expect(respuesta.status).toBe(403);
    });
  });

  describe('GET /api/donations/mias', () => {
    it('devuelve solo las donaciones del donador autenticado', async () => {
      const respuesta = await request(app).get('/api/donations/mias').set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(200);
      expect(Array.isArray(respuesta.body)).toBe(true);
      expect(respuesta.body.every((d) => d.donadorId === donador.id)).toBe(true);
    });
  });

  describe('Notificaciones del donador', () => {
    it('devuelve una lista (vacía o no) sin errores', async () => {
      const respuesta = await request(app)
        .get('/api/donations/notificaciones')
        .set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(200);
      expect(Array.isArray(respuesta.body)).toBe(true);
    });

    it('rechaza marcar como leída una notificación de otro usuario', async () => {
      const respuesta = await request(app)
        .patch('/api/donations/notificaciones/999999/leida')
        .set('Authorization', `Bearer ${token}`);

      expect(respuesta.status).toBe(404);
    });
  });
});