const { Donation, User, Beneficiary, Notification } = require('../models');
const { CATEGORIAS } = require('../config/constantes');

async function crear(req, res) {
  try {
    const { producto, categoria, cantidad, peso, perecedero, fechaCaducidad, beneficiarioId } = req.body;

    if (!producto || !categoria || !cantidad || !peso) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (!CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'La imagen del producto es obligatoria' });
    }

    const esPerecedero = perecedero === 'true' || perecedero === true;

    if (beneficiarioId) {
      const existe = await Beneficiary.findByPk(beneficiarioId);
      if (!existe) {
        return res.status(400).json({ error: 'El beneficiario indicado no existe' });
      }
    }

    const donacion = await Donation.create({
      producto,
      categoria,
      cantidad: Number(cantidad),
      peso: Number(peso),
      perecedero: esPerecedero,
      fechaCaducidad: esPerecedero ? fechaCaducidad : null,
      beneficiarioId: beneficiarioId || null,
      imagen: `/uploads/${req.file.filename}`,
      donadorId: req.usuario.id,
    });

    res.status(201).json({ mensaje: 'Donación registrada', donacion });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function misDonaciones(req, res) {
  try {
    const donaciones = await Donation.findAll({
      where: { donadorId: req.usuario.id },
      include: [{ model: Beneficiary, as: 'beneficiario', attributes: ['nombre'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(donaciones);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function misNotificaciones(req, res) {
  try {
    const notificaciones = await Notification.findAll({
      where: { userId: req.usuario.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(notificaciones);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function marcarNotificacionLeida(req, res) {
  try {
    const notif = await Notification.findOne({
      where: { id: req.params.id, userId: req.usuario.id },
    });
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });

    notif.leida = true;
    await notif.save();
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

module.exports = { crear, misDonaciones, misNotificaciones, marcarNotificacionLeida };