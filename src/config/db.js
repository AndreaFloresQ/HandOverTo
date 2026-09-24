const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT,
    logging: false,
  }
);

async function conectarDB() {
  try {
    await sequelize.authenticate();
    console.log('Base de datos conectada');
  } catch (err) {
    console.error('Error al conectar a la base de datos:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, conectarDB };