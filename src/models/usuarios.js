const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { ROLES } = require('../config/constantes');

const Usuarios = sequelize.define('Usuarios', {
  nombre: { type: DataTypes.STRING, allowNull: false },
  empresa: { type: DataTypes.STRING},
  direccion: { type: DataTypes.STRING, allowNull: false },
  ciudad: { type: DataTypes.STRING, allowNull: false },
  telefono: { type: DataTypes.STRING, allowNull: false },
  correo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: { type: DataTypes.STRING, allowNull: false },
  rol: {
    type: DataTypes.ENUM(...ROLES),
    allowNull: false,
    defaultValue: 'donador',
  },
});

module.exports = Usuarios;