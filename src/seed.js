require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./config/db');
const { User, Collector, Beneficiary, BeneficiaryCategory } = require('./models');

async function seed() {
  await sequelize.sync();

  await User.findOrCreate({
    where: { correo: 'admin@donaciones.test' },
    defaults: {
      nombre: 'Administrador',
      direccion: 'Oficina central',
      ciudad: 'Ciudad',
      telefono: '0000000000',
      password: await bcrypt.hash('Admin12345', 10),
      rol: 'admin',
    },
  });

  if ((await Collector.count()) === 0) {
    await Collector.bulkCreate([
      { nombre: 'Juan Pérez', telefono: '5551110001', vehiculo: 'Camioneta pickup', capacidadKg: 800 },
      { nombre: 'María López', telefono: '5551110002', vehiculo: 'Camión refrigerado', capacidadKg: 2000 },
    ]);
  }

  if ((await Beneficiary.count()) === 0) {
    const b1 = await Beneficiary.create({
      nombre: 'Casa Hogar Esperanza',
      razonSocial: 'Casa Hogar Esperanza A.C.',
      rfc: 'CHE010101AAA',
      direccion: 'Calle 1 #100',
      telefono: '5552220001',
      encargado: 'Laura Gómez',
    });
    const b2 = await Beneficiary.create({
      nombre: 'Banco de Alimentos Local',
      razonSocial: 'Banco de Alimentos Local A.C.',
      rfc: 'BAL020202BBB',
      direccion: 'Avenida 2 #200',
      telefono: '5552220002',
      encargado: 'Pedro Ruiz',
    });
    await BeneficiaryCategory.bulkCreate([
      { beneficiarioId: b1.id, categoria: 'alimentos' },
      { beneficiarioId: b1.id, categoria: 'ropa' },
      { beneficiarioId: b2.id, categoria: 'alimentos' },
      { beneficiarioId: b2.id, categoria: 'higiene' },
    ]);
  }

  console.log('Datos iniciales listos');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});