const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Beneficiary, BeneficiaryCategory, Collector, Donation, Notification } = require('../src/models');

const idsUsuarios = [];
const idsBeneficiarios = [];
const idsRecolectores = [];
const idsDonaciones = [];

async function crearUsuario({ rol = 'donador', correo, ...resto } = {}) {
  const usuario = await User.create({
    nombre: resto.nombre || 'Usuario de prueba',
    direccion: resto.direccion || 'Calle de prueba 123',
    ciudad: resto.ciudad || 'Ciudad de prueba',
    telefono: resto.telefono || '5550000000',
    correo: correo || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: await bcrypt.hash('Password123', 10),
    rol,
  });
  idsUsuarios.push(usuario.id);
  return usuario;
}

function generarToken(usuario) {
  return jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '2h' });
}

async function crearBeneficiario({ categorias = ['alimentos'], ...resto } = {}) {
  const beneficiario = await Beneficiary.create({
    nombre: resto.nombre || `Beneficiario de prueba ${Date.now()}`,
    razonSocial: resto.razonSocial || 'Prueba A.C.',
    rfc: resto.rfc || 'TEST010101AAA',
    direccion: resto.direccion || 'Avenida de prueba 1',
    telefono: resto.telefono || '5550000001',
    encargado: resto.encargado || 'Encargado de prueba',
  });
  idsBeneficiarios.push(beneficiario.id);

  await BeneficiaryCategory.bulkCreate(
    categorias.map((categoria) => ({ beneficiarioId: beneficiario.id, categoria }))
  );

  return beneficiario;
}

async function crearRecolector({ capacidadKg = 1000, ...resto } = {}) {
  const recolector = await Collector.create({
    nombre: resto.nombre || `Recolector de prueba ${Date.now()}`,
    telefono: resto.telefono || '5550000002',
    vehiculo: resto.vehiculo || 'Camioneta de prueba',
    capacidadKg,
  });
  idsRecolectores.push(recolector.id);
  return recolector;
}

async function crearDonacion({ donadorId, ...resto }) {
  const donacion = await Donation.create({
    producto: resto.producto || 'Producto de prueba',
    categoria: resto.categoria || 'alimentos',
    cantidad: resto.cantidad ?? 5,
    peso: resto.peso ?? 10,
    imagen: resto.imagen || '/uploads/prueba.jpg',
    perecedero: resto.perecedero ?? false,
    fechaCaducidad: resto.fechaCaducidad ?? null,
    beneficiarioId: resto.beneficiarioId ?? null,
    estado: resto.estado || 'pendiente',
    donadorId,
  });
  idsDonaciones.push(donacion.id);
  return donacion;
}

async function crearNotificacion({ userId, mensaje = 'Notificación de prueba', leida = false }) {
  return Notification.create({ userId, mensaje, leida });
}
// Se llama en el afterAll de cada archivo de pruebas.
// Se borra en orden inverso a las dependencias: donaciones y notificaciones primero,
// porque tienen llaves foráneas hacia usuarios/beneficiarios/recolectores.
async function limpiarDatosDePrueba() {
  if (idsUsuarios.length) {
    await Notification.destroy({ where: { userId: idsUsuarios } });
  }
  if (idsDonaciones.length) {
    await Donation.destroy({ where: { id: idsDonaciones } });
    idsDonaciones.length = 0;
  }
  if (idsBeneficiarios.length) {
    await BeneficiaryCategory.destroy({ where: { beneficiarioId: idsBeneficiarios } });
    await Beneficiary.destroy({ where: { id: idsBeneficiarios } });
    idsBeneficiarios.length = 0;
  }
  if (idsRecolectores.length) {
    await Collector.destroy({ where: { id: idsRecolectores } });
    idsRecolectores.length = 0;
  }
  if (idsUsuarios.length) {
    await User.destroy({ where: { id: idsUsuarios } });
    idsUsuarios.length = 0;
  }
}

module.exports = {
  crearUsuario,
  generarToken,
  crearBeneficiario,
  crearRecolector,
  crearDonacion,
  crearNotificacion,
  limpiarDatosDePrueba,
};

