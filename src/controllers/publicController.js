const { Beneficiary, BeneficiaryCategory } = require('../models');

async function listarBeneficiarios(req, res) {
  const beneficiarios = await Beneficiary.findAll({
    attributes: ['id', 'nombre'],
    include: [{ model: BeneficiaryCategory, as: 'categorias', attributes: ['categoria'] }],
    order: [['nombre', 'ASC']],
  });
  res.json(beneficiarios);
}

module.exports = { listarBeneficiarios };