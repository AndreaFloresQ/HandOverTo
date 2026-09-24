const User = require('./usuarios');
const Beneficiary = require('./beneficiarios');
const BeneficiaryCategory = require('./beneficiariosCategorias');
const Collector = require('./recolectores');
const Donation = require('./donaciones');
const Notification = require('./notificaciones');

// Un donador tiene muchas donaciones
User.hasMany(Donation, { foreignKey: { name: 'donadorId', allowNull: false }, as: 'donaciones' });
Donation.belongsTo(User, { foreignKey: { name: 'donadorId', allowNull: false }, as: 'donador' });

// Beneficiario y recolector son opcionales hasta que el admin los asigna
Beneficiary.hasMany(Donation, { foreignKey: 'beneficiarioId', as: 'donaciones' });
Donation.belongsTo(Beneficiary, { foreignKey: 'beneficiarioId', as: 'beneficiario' });

Collector.hasMany(Donation, { foreignKey: 'recolectorId', as: 'donaciones' });
Donation.belongsTo(Collector, { foreignKey: 'recolectorId', as: 'recolector' });

// Categorías que necesita cada beneficiario
Beneficiary.hasMany(BeneficiaryCategory, {
  foreignKey: { name: 'beneficiarioId', allowNull: false },
  as: 'categorias',
  onDelete: 'CASCADE',
});
BeneficiaryCategory.belongsTo(Beneficiary, {
  foreignKey: { name: 'beneficiarioId', allowNull: false },
});

// Notificaciones de cada usuario
User.hasMany(Notification, { foreignKey: { name: 'userId', allowNull: false }, as: 'notificaciones' });
Notification.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false }, as: 'usuario' });

module.exports = { User, Beneficiary, BeneficiaryCategory, Collector, Donation, Notification };