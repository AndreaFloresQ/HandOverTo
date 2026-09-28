const { Beneficiary, BeneficiaryCategory } = require('../models');
const { CATEGORIAS } = require('../config/constantes');

const CAMPOS = ['nombre', 'razonSocial', 'rfc', 'direccion', 'telefono', 'encargado'];

function campoInvalido(valor) {
  return typeof valor !== 'string' || valor.trim() === '' || valor.length > 255;
}

function categoriasInvalidas(categorias) {
  return (
    !Array.isArray(categorias) ||
    categorias.length === 0 ||
    categorias.some((c) => !CATEGORIAS.includes(c))
  );
}

async function listar(req, res) {
  const beneficiarios = await Beneficiary.findAll({
    include: [{ model: BeneficiaryCategory, as: 'categorias', attributes: ['categoria'] }],
    order: [['nombre', 'ASC']],
  });
  res.json(beneficiarios);
}

async function crear(req, res) {
  try {
    const { categorias } = req.body;

    if (CAMPOS.some((campo) => req.body[campo] === undefined || req.body[campo] === '')) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (CAMPOS.some((campo) => campoInvalido(req.body[campo]))) {
      return res.status(400).json({ error: 'Algún campo no es válido (debe ser texto de máximo 255 caracteres)' });
    }
    if (!Array.isArray(categorias) || categorias.length === 0) {
      return res.status(400).json({ error: 'Debes indicar al menos una categoría' });
    }
    if (categoriasInvalidas(categorias)) {
      return res.status(400).json({ error: 'Hay una categoría inválida' });
    }

    const datos = Object.fromEntries(CAMPOS.map((campo) => [campo, req.body[campo].trim()]));
    const beneficiario = await Beneficiary.create(datos);
    await BeneficiaryCategory.bulkCreate(
      [...new Set(categorias)].map((categoria) => ({ beneficiarioId: beneficiario.id, categoria }))
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

  const { categorias } = req.body;
  const cambios = {};

  for (const campo of CAMPOS) {
    if (req.body[campo] !== undefined) {
      if (campoInvalido(req.body[campo])) {
        return res.status(400).json({ error: `El campo ${campo} no es válido` });
      }
      cambios[campo] = req.body[campo].trim();
    }
  }
  if (categorias !== undefined && categoriasInvalidas(categorias)) {
    return res.status(400).json({ error: 'Las categorías indicadas no son válidas' });
  }

  await beneficiario.update(cambios);

  if (categorias !== undefined) {
    await BeneficiaryCategory.destroy({ where: { beneficiarioId: beneficiario.id } });
    await BeneficiaryCategory.bulkCreate(
      [...new Set(categorias)].map((categoria) => ({ beneficiarioId: beneficiario.id, categoria }))
    );
  }

  res.json({ mensaje: 'Beneficiario actualizado', beneficiario });
}

async function eliminar(req, res) {
  const beneficiario = await Beneficiary.findByPk(req.params.id);
  if (!beneficiario) return res.status(404).json({ error: 'Beneficiario no encontrado' });

  await beneficiario.destroy(); // BeneficiaryCategory se borra en cascada
  res.json({ mensaje: 'Beneficiario eliminado' });
}

module.exports = { listar, crear, actualizar, eliminar };