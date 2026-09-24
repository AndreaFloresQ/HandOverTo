const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Beneficiarios = sequelize.define('Beneficiarios', {
  nombre: { type: DataTypes.STRING, allowNull: false },
  razonSocial: { type: DataTypes.STRING, allowNull: false },
  rfc: { type: DataTypes.STRING, allowNull: false },
  direccion: { type: DataTypes.STRING, allowNull: false },
  telefono: { type: DataTypes.STRING, allowNull: false },
  encargado: { type: DataTypes.STRING, allowNull: false },
});

module.exports = Beneficiarios;