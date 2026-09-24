const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { CATEGORIAS, ESTADOS } = require('../config/constantes');

const Donaciones = sequelize.define('Donaciones', {
    producto: { type: DataTypes.STRING, allowNull: false },
    categoria: { type: DataTypes.ENUM(...CATEGORIAS), allowNull: false },
    cantidad: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    peso: { type: DataTypes.FLOAT, allowNull: false, validate: { min: 0 } },
    imagen: { type: DataTypes.STRING, allowNull: false },
    perecedero: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    fechaCaducidad: { type: DataTypes.DATEONLY },
    estado: {
      type: DataTypes.ENUM(...ESTADOS),
      allowNull: false,
      defaultValue: 'pendiente',
    },
    motivoRechazo: { type: DataTypes.TEXT },
    urgencia: {
      type: DataTypes.VIRTUAL,
      get() {
        if (!this.perecedero || !this.fechaCaducidad) return 'baja';
        const dias = Math.ceil((new Date(this.fechaCaducidad) - new Date()) / 86400000);
        if (dias <= 2) return 'alta';
        if (dias <= 7) return 'media';
        return 'baja';
      },
    },
  },
  {
    validate: {
      caducidadSiPerecedero() {
        if (this.perecedero && !this.fechaCaducidad) {
          throw new Error('La fecha de caducidad es obligatoria para productos perecederos');
        }
      },
    },
  }
);

module.exports = Donaciones;