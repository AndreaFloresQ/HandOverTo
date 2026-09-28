const request = require('supertest');
const app = require('../src/app');
const {
  crearUsuario,
  generarToken,
  crearBeneficiario,
  crearRecolector,
  crearDonacion,
  limpiarDatosDePrueba,
} = require('./helpers');

describe('Donaciones (lado admin)', () => {
  let admin;
  let tokenAdmin;
  let donador;

  beforeAll(async () => {
    admin = await crearUsuario({ rol: 'admin' });
    tokenAdmin = generarToken(admin);
    donador = await crearUsuario({ rol: 'donador' });
  });

  afterAll(async () => {
    await limpiarDatosDePrueba();
  });

  describe('GET /api/admin/donations', () => {
    it('lista las donaciones e incluye el campo urgencia', async () => {
      await crearDonacion({ donadorId: donador.id });

      const respuesta = await request(app).get('/api/admin/donations').set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body[0]).toHaveProperty('urgencia');
    });

    it('filtra por estado', async () => {
      const respuesta = await request(app)
        .get('/api/admin/donations?estado=pendiente')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.every((d) => d.estado === 'pendiente')).toBe(true);
    });

    it('rechaza a un donador (403)', async () => {
      const tokenDonador = generarToken(donador);
      const respuesta = await request(app).get('/api/admin/donations').set('Authorization', `Bearer ${tokenDonador}`);
      expect(respuesta.status).toBe(403);
    });
  });

  describe('PATCH /api/admin/donations/:id/decidir', () => {
    it('rechaza aprobar sin recolector', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id });
      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar' });

      expect(respuesta.status).toBe(400);
    });

    it('rechaza aprobar sin beneficiario (ni del donador ni del admin)', async () => {
      const recolector = await crearRecolector({ capacidadKg: 100 });
      const donacion = await crearDonacion({ donadorId: donador.id, peso: 5 });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toMatch(/beneficiario/i);
    });

    it('rechaza aprobar si el peso excede la capacidad del recolector', async () => {
      const beneficiario = await crearBeneficiario();
      const recolector = await crearRecolector({ capacidadKg: 10 });
      const donacion = await crearDonacion({
        donadorId: donador.id,
        peso: 50,
        beneficiarioId: beneficiario.id,
      });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toMatch(/capacidad/i);
    });

    it('aprueba correctamente cuando todo es válido', async () => {
      const beneficiario = await crearBeneficiario();
      const recolector = await crearRecolector({ capacidadKg: 100 });
      const donacion = await crearDonacion({
        donadorId: donador.id,
        peso: 5,
        beneficiarioId: beneficiario.id,
      });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.donacion.estado).toBe('en_camino');
    });

    it('no permite aprobar dos veces la misma donación', async () => {
      const beneficiario = await crearBeneficiario();
      const recolector = await crearRecolector({ capacidadKg: 100 });
      const donacion = await crearDonacion({
        donadorId: donador.id,
        peso: 5,
        beneficiarioId: beneficiario.id,
      });

      await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id });

      const segundaVez = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id });

      expect(segundaVez.status).toBe(400);
    });

    it('rechaza una donación con motivo', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'rechazar', motivoRechazo: 'Producto sospechoso' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.donacion.estado).toBe('rechazada');
    });

    it('rechaza rechazar sin motivo', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'rechazar' });

      expect(respuesta.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/donations/:id/estado', () => {
    it('avanza el estado cuando hay beneficiario asignado', async () => {
      const beneficiario = await crearBeneficiario();
      const donacion = await crearDonacion({
        donadorId: donador.id,
        estado: 'en_camino',
        beneficiarioId: beneficiario.id,
      });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/estado`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'en_transito' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.donacion.estado).toBe('en_transito');
    });

    it('bloquea el avance si no tiene beneficiario asignado', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id, estado: 'en_camino' });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/estado`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'en_transito' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toMatch(/beneficiario/i);
    });

    it('rechaza un estado no permitido', async () => {
      const beneficiario = await crearBeneficiario();
      const donacion = await crearDonacion({
        donadorId: donador.id,
        estado: 'en_camino',
        beneficiarioId: beneficiario.id,
      });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/estado`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'pendiente' });

      expect(respuesta.status).toBe(400);
    });

    it('no permite modificar una donación ya entregada', async () => {
      const beneficiario = await crearBeneficiario();
      const donacion = await crearDonacion({
        donadorId: donador.id,
        estado: 'entregada',
        beneficiarioId: beneficiario.id,
      });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/estado`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'en_transito' });

      expect(respuesta.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/donations/:id/beneficiario', () => {
    it('asigna un beneficiario a una donación que no tenía', async () => {
      const beneficiario = await crearBeneficiario();
      const donacion = await crearDonacion({ donadorId: donador.id, estado: 'en_camino' });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/beneficiario`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ beneficiarioId: beneficiario.id });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.donacion.beneficiarioId).toBe(beneficiario.id);
    });

    it('rechaza la petición sin beneficiarioId', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id, estado: 'en_camino' });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/beneficiario`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({});

      expect(respuesta.status).toBe(400);
    });
  });
});