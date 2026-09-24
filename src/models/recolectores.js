const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Recolectores = sequelize.define('Recolectores', {
  nombre: { type: DataTypes.STRING, allowNull: false },
  telefono: { type: DataTypes.STRING, allowNull: false },
  vehiculo: { type: DataTypes.STRING, allowNull: false },
  capacidadKg: { type: DataTypes.FLOAT, allowNull: false },
});

module.exports = Recolectores;