require('dotenv').config();
const { sequelize } = require('../src/config/db');
require('../src/models');

module.exports = async () => {
  await sequelize.authenticate();
  await sequelize.sync(); // crea tablas si faltan; NO borra nada existente
  await sequelize.close();
};