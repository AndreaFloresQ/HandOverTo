const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { CATEGORIAS } = require('../config/constantes');

const BeneficiariosCategorias = sequelize.define('BeneficiariosCategorias', {
  categoria: { type: DataTypes.ENUM(...CATEGORIAS), allowNull: false },
});

module.exports = BeneficiariosCategorias;