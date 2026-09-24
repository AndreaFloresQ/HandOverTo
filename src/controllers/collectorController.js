const { Collector } = require('../models');

async function listar(req, res) {
  const recolectores = await Collector.findAll({ order: [['nombre', 'ASC']] });
  res.json(recolectores);
}

module.exports = { listar };