const { Beneficiary, BeneficiaryCategory } = require('../models');
const { CATEGORIAS } = require('../config/constantes');

async function listar(req, res) {
  const beneficiarios = await Beneficiary.findAll({
    include: [{ model: BeneficiaryCategory, as: 'categorias', attributes: ['categoria'] }],
    order: [['nombre', 'ASC']],
  });
  res.json(beneficiarios);
}

async function crear(req, res) {
  try {
    const { nombre, razonSocial, rfc, direccion, telefono, encargado, categorias } = req.body;

    if (!nombre || !razonSocial || !rfc || !direccion || !telefono || !encargado) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (!Array.isArray(categorias) || categorias.length === 0) {
      return res.status(400).json({ error: 'Debes indicar al menos una categoría' });
    }
    if (categorias.some((c) => !CATEGORIAS.includes(c))) {
      return res.status(400).json({ error: 'Hay una categoría inválida' });
    }

    const beneficiario = await Beneficiary.create({ nombre, razonSocial, rfc, direccion, telefono, encargado });
    await BeneficiaryCategory.bulkCreate(
      categorias.map((categoria) => ({ beneficiarioId: beneficiario.id, categoria }))
    );

    res.status(201).json({ mensaje: 'Beneficiario creado', beneficiario });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function actualizar(req, res) {
  const beneficiario = await Beneficiary.findByPk(req.params.id);
  if (!beneficiario) return res.status(404).json({ error: 'Beneficiario no encontrado' });

  const { nombre, razonSocial, rfc, direccion, telefono, encargado, categorias } = req.body;
  await beneficiario.update({ nombre, razonSocial, rfc, direccion, telefono, encargado });

  if (Array.isArray(categorias)) {
    if (categorias.some((c) => !CATEGORIAS.includes(c))) {
      return res.status(400).json({ error: 'Hay una categoría inválida' });
    }
    await BeneficiaryCategory.destroy({ where: { beneficiarioId: beneficiario.id } });
    await BeneficiaryCategory.bulkCreate(
      categorias.map((categoria) => ({ beneficiarioId: beneficiario.id, categoria }))
    );
  }

  res.json({ mensaje: 'Beneficiario actualizado', beneficiario });
}

async function eliminar(req, res) {
  const beneficiario = await Beneficiary.findByPk(req.params.id);
  if (!beneficiario) return res.status(404).json({ error: 'Beneficiario no encontrado' });

  await beneficiario.destroy(); // BeneficiaryCategory se borra en cascada (onDelete: 'CASCADE')
  res.json({ mensaje: 'Beneficiario eliminado' });
}

module.exports = { listar, crear, actualizar, eliminar };