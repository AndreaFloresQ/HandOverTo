const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Notificaciones = sequelize.define('Notificaciones', {
  mensaje: { type: DataTypes.STRING, allowNull: false },
  leida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

module.exports = Notificaciones;