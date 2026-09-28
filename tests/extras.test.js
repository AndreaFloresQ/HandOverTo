const request = require('supertest');
const path = require('path');
const app = require('../src/app');
const { User } = require('../src/models');
const {
  crearUsuario,
  generarToken,
  crearBeneficiario,
  crearRecolector,
  crearDonacion,
  crearNotificacion,
  limpiarDatosDePrueba,
} = require('./helpers');

const imagenPrueba = path.join(__dirname, 'fixtures', 'producto.jpg');

describe('Casos adicionales', () => {
  let donador;
  let tokenDonador;
  let tokenAdmin;

  beforeAll(async () => {
    donador = await crearUsuario({ rol: 'donador' });
    tokenDonador = generarToken(donador);
    tokenAdmin = generarToken(await crearUsuario({ rol: 'admin' }));
  });

  afterAll(async () => {
    await limpiarDatosDePrueba();
  });

  describe('Autenticación', () => {
    it('rechaza un registro con correo de formato inválido', async () => {
      const respuesta = await request(app).post('/api/auth/register').send({
        nombre: 'Correo Malo',
        direccion: 'Calle 1',
        ciudad: 'Ciudad',
        telefono: '5551112222',
        correo: 'esto-no-es-un-correo',
        password: 'MiClave123',
      });

      expect(respuesta.status).toBe(400);
    });

    it('rechaza un login sin cuerpo', async () => {
      const respuesta = await request(app).post('/api/auth/login').send({});
      expect(respuesta.status).toBe(400);
    });

    it('devuelve 404 en /me si el usuario del token ya no existe', async () => {
      const temporal = await crearUsuario({ rol: 'donador' });
      const token = generarToken(temporal);
      await User.destroy({ where: { id: temporal.id } });

      const respuesta = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(respuesta.status).toBe(404);
    });

    it('permite a un donador entrar a /api/donador/ping', async () => {
      const respuesta = await request(app).get('/api/donador/ping').set('Authorization', `Bearer ${tokenDonador}`);
      expect(respuesta.status).toBe(200);
    });
  });

  describe('Creación de donaciones: validaciones', () => {
    it('rechaza si faltan campos obligatorios', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'Incompleto')
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(400);
    });

    it('rechaza un beneficiario que no existe', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'Beneficiario fantasma')
        .field('categoria', 'alimentos')
        .field('cantidad', 1)
        .field('peso', 1)
        .field('beneficiarioId', 999999999)
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(400);
    });

    it('rechaza un producto perecedero sin fecha de caducidad', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'Leche')
        .field('categoria', 'alimentos')
        .field('cantidad', 1)
        .field('peso', 1)
        .field('perecedero', 'true')
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(400);
    });

    it('acepta un producto perecedero con fecha de caducidad', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'Yogur')
        .field('categoria', 'alimentos')
        .field('cantidad', 4)
        .field('peso', 2)
        .field('perecedero', 'true')
        .field('fechaCaducidad', '2030-01-01')
        .attach('imagen', imagenPrueba);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.donacion.perecedero).toBe(true);
    });

    it('rechaza un archivo que no es imagen (400)', async () => {
      const respuesta = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${tokenDonador}`)
        .field('producto', 'Archivo malo')
        .field('categoria', 'alimentos')
        .field('cantidad', 1)
        .field('peso', 1)
        .attach('imagen', Buffer.from('no soy una imagen'), 'archivo.txt');

      expect(respuesta.status).toBe(400);
    });
  });

  describe('Urgencia calculada', () => {
    const fechaEn = (dias) => {
      const f = new Date();
      f.setDate(f.getDate() + dias);
      return f.toISOString().slice(0, 10);
    };

    it.each([
      ['alta', 1],
      ['media', 5],
      ['baja', 30],
    ])('marca urgencia %s si caduca en %i días', async (esperada, dias) => {
      await crearDonacion({
        donadorId: donador.id,
        producto: `Urgencia ${esperada}`,
        perecedero: true,
        fechaCaducidad: fechaEn(dias),
      });

      const respuesta = await request(app).get('/api/admin/donations').set('Authorization', `Bearer ${tokenAdmin}`);
      const donacion = respuesta.body.find((d) => d.producto === `Urgencia ${esperada}`);

      expect(donacion.urgencia).toBe(esperada);
    });

    it('marca urgencia baja para un no perecedero', async () => {
      await crearDonacion({ donadorId: donador.id, producto: 'No perecedero', perecedero: false });

      const respuesta = await request(app).get('/api/admin/donations').set('Authorization', `Bearer ${tokenAdmin}`);
      const donacion = respuesta.body.find((d) => d.producto === 'No perecedero');

      expect(donacion.urgencia).toBe('baja');
    });
  });

  describe('Notificaciones', () => {
    it('lista y marca como leída una notificación propia', async () => {
      const notif = await crearNotificacion({ userId: donador.id });

      const lista = await request(app)
        .get('/api/donations/notificaciones')
        .set('Authorization', `Bearer ${tokenDonador}`);
      expect(lista.body.some((n) => n.id === notif.id)).toBe(true);

      const respuesta = await request(app)
        .patch(`/api/donations/notificaciones/${notif.id}/leida`)
        .set('Authorization', `Bearer ${tokenDonador}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.leida).toBe(true);
    });

    it('no permite marcar la notificación de otro usuario', async () => {
      const otro = await crearUsuario({ rol: 'donador' });
      const notifAjena = await crearNotificacion({ userId: otro.id });

      const respuesta = await request(app)
        .patch(`/api/donations/notificaciones/${notifAjena.id}/leida`)
        .set('Authorization', `Bearer ${tokenDonador}`);

      expect(respuesta.status).toBe(404);
    });
  });

  describe('Aprobación: casos de error restantes', () => {
    it('devuelve 404 si la donación no existe (decidir)', async () => {
      const respuesta = await request(app)
        .patch('/api/admin/donations/999999999/decidir')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'rechazar', motivoRechazo: 'x' });

      expect(respuesta.status).toBe(404);
    });

    it('rechaza una acción inválida', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'inventada' });

      expect(respuesta.status).toBe(400);
    });

    it('rechaza aprobar con un recolector que no existe', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: 999999999 });

      expect(respuesta.status).toBe(400);
    });

    it('rechaza aprobar con un beneficiario que no existe', async () => {
      const recolector = await crearRecolector({ capacidadKg: 100 });
      const donacion = await crearDonacion({ donadorId: donador.id, peso: 5 });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id, beneficiarioId: 999999999 });

      expect(respuesta.status).toBe(400);
    });

    it('permite al admin elegir el beneficiario al aprobar', async () => {
      const beneficiario = await crearBeneficiario();
      const recolector = await crearRecolector({ capacidadKg: 100 });
      const donacion = await crearDonacion({ donadorId: donador.id, peso: 5 });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/decidir`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ accion: 'aprobar', recolectorId: recolector.id, beneficiarioId: beneficiario.id });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.donacion.beneficiarioId).toBe(beneficiario.id);
    });
  });

  describe('Cambio de estado y asignación: casos de error restantes', () => {
    it('devuelve 404 al cambiar el estado de una donación inexistente', async () => {
      const respuesta = await request(app)
        .patch('/api/admin/donations/999999999/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'en_transito' });

      expect(respuesta.status).toBe(404);
    });

    it('devuelve 404 al asignar beneficiario a una donación inexistente', async () => {
      const beneficiario = await crearBeneficiario();

      const respuesta = await request(app)
        .patch('/api/admin/donations/999999999/beneficiario')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ beneficiarioId: beneficiario.id });

      expect(respuesta.status).toBe(404);
    });

    it('rechaza asignar un beneficiario inexistente', async () => {
      const donacion = await crearDonacion({ donadorId: donador.id, estado: 'en_camino' });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/beneficiario`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ beneficiarioId: 999999999 });

      expect(respuesta.status).toBe(400);
    });

    it('no permite reasignar beneficiario en una donación entregada', async () => {
      const beneficiario = await crearBeneficiario();
      const donacion = await crearDonacion({
        donadorId: donador.id,
        estado: 'entregada',
        beneficiarioId: beneficiario.id,
      });

      const respuesta = await request(app)
        .patch(`/api/admin/donations/${donacion.id}/beneficiario`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ beneficiarioId: beneficiario.id });

      expect(respuesta.status).toBe(400);
    });
  });
});