const request = require('supertest');
const app = require('../src/app');
const { Beneficiary, BeneficiaryCategory } = require('../src/models');
const {
  crearUsuario,
  generarToken,
  crearBeneficiario,
  crearRecolector,
  limpiarDatosDePrueba,
} = require('./helpers');

describe('Beneficiarios, recolectores y rutas públicas', () => {
  let tokenAdmin;
  let tokenDonador;
  const idsCreadosPorApi = [];

  const datosBeneficiario = () => ({
    nombre: `Beneficiario API ${Date.now()}`,
    razonSocial: 'Prueba API A.C.',
    rfc: 'TESTAPI010101',
    direccion: 'Calle API 1',
    telefono: '5559990000',
    encargado: 'Encargado API',
    categorias: ['alimentos', 'ropa'],
  });

  beforeAll(async () => {
    tokenAdmin = generarToken(await crearUsuario({ rol: 'admin' }));
    tokenDonador = generarToken(await crearUsuario({ rol: 'donador' }));
  });

  afterAll(async () => {
    if (idsCreadosPorApi.length) {
      await BeneficiaryCategory.destroy({ where: { beneficiarioId: idsCreadosPorApi } });
      await Beneficiary.destroy({ where: { id: idsCreadosPorApi } });
    }
    await limpiarDatosDePrueba();
  });

  describe('GET /api/admin/beneficiaries', () => {
    it('lista los beneficiarios con sus categorías', async () => {
      await crearBeneficiario({ categorias: ['higiene'] });

      const respuesta = await request(app)
        .get('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.length).toBeGreaterThan(0);
      expect(respuesta.body[0]).toHaveProperty('categorias');
    });

    it('rechaza a un donador (403)', async () => {
      const respuesta = await request(app)
        .get('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenDonador}`);

      expect(respuesta.status).toBe(403);
    });
  });

  describe('POST /api/admin/beneficiaries', () => {
    it('crea un beneficiario con categorías', async () => {
      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(datosBeneficiario());

      expect(respuesta.status).toBe(201);
      idsCreadosPorApi.push(respuesta.body.beneficiario.id);
    });

    it('rechaza si faltan campos obligatorios', async () => {
      const { rfc, ...incompleto } = datosBeneficiario();

      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(incompleto);

      expect(respuesta.status).toBe(400);
    });

    it('rechaza si no se indica ninguna categoría', async () => {
      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...datosBeneficiario(), categorias: [] });

      expect(respuesta.status).toBe(400);
    });

    it('rechaza una categoría inválida', async () => {
      const respuesta = await request(app)
        .post('/api/admin/beneficiaries')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...datosBeneficiario(), categorias: ['juguetes'] });

      expect(respuesta.status).toBe(400);
    });
  });

  describe('PUT /api/admin/beneficiaries/:id', () => {
    it('actualiza datos y reemplaza las categorías', async () => {
      const beneficiario = await crearBeneficiario({ categorias: ['alimentos'] });

      const respuesta = await request(app)
        .put(`/api/admin/beneficiaries/${beneficiario.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Nombre actualizado', categorias: ['ropa', 'higiene'] });

      expect(respuesta.status).toBe(200);

      const categorias = await BeneficiaryCategory.findAll({ where: { beneficiarioId: beneficiario.id } });
      expect(categorias.map((c) => c.categoria).sort()).toEqual(['higiene', 'ropa']);
    });

    it('devuelve 404 si el beneficiario no existe', async () => {
      const respuesta = await request(app)
        .put('/api/admin/beneficiaries/999999999')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'No existe' });

      expect(respuesta.status).toBe(404);
    });

    it('rechaza categorías inválidas al actualizar', async () => {
      const beneficiario = await crearBeneficiario();

      const respuesta = await request(app)
        .put(`/api/admin/beneficiaries/${beneficiario.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ categorias: ['juguetes'] });

      expect(respuesta.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/beneficiaries/:id', () => {
    it('elimina un beneficiario', async () => {
      const beneficiario = await crearBeneficiario();

      const respuesta = await request(app)
        .delete(`/api/admin/beneficiaries/${beneficiario.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(await Beneficiary.findByPk(beneficiario.id)).toBeNull();
    });

    it('devuelve 404 si no existe', async () => {
      const respuesta = await request(app)
        .delete('/api/admin/beneficiaries/999999999')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(404);
    });
  });

  describe('GET /api/admin/collectors', () => {
    it('lista los recolectores', async () => {
      await crearRecolector();

      const respuesta = await request(app)
        .get('/api/admin/collectors')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.length).toBeGreaterThan(0);
    });

    it('rechaza a un donador (403)', async () => {
      const respuesta = await request(app)
        .get('/api/admin/collectors')
        .set('Authorization', `Bearer ${tokenDonador}`);

      expect(respuesta.status).toBe(403);
    });
  });

  describe('GET /api/public/beneficiaries', () => {
    it('es accesible sin token y solo expone id, nombre y categorías', async () => {
      await crearBeneficiario({ categorias: ['alimentos'] });

      const respuesta = await request(app).get('/api/public/beneficiaries');

      expect(respuesta.status).toBe(200);
      const primero = respuesta.body[0];
      expect(primero).toHaveProperty('id');
      expect(primero).toHaveProperty('nombre');
      expect(primero).not.toHaveProperty('rfc');
      expect(primero).not.toHaveProperty('telefono');
    });
  });
});