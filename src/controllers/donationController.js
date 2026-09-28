const { Donation, User, Beneficiary, Notification } = require('../models');
const { CATEGORIAS } = require('../config/constantes');

async function crear(req, res) {
  try {
    const { producto, categoria, cantidad, peso, perecedero, fechaCaducidad, beneficiarioId } = req.body;

    if (!producto || !categoria || !cantidad || !peso) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (typeof producto !== 'string' || producto.length > 255) {
      return res.status(400).json({ error: 'El nombre del producto no es válido (máximo 255 caracteres)' });
    }
    if (!CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }

    const cantidadNum = Number(cantidad);
    const pesoNum = Number(peso);
    if (!Number.isInteger(cantidadNum) || cantidadNum < 1 || cantidadNum > 1000000) {
      return res.status(400).json({ error: 'La cantidad debe ser un número entero entre 1 y 1,000,000' });
    }
    if (!Number.isFinite(pesoNum) || pesoNum <= 0 || pesoNum > 100000) {
      return res.status(400).json({ error: 'El peso debe ser mayor a 0 y máximo 100,000 kg' });
    }
    if (beneficiarioId && !Number.isInteger(Number(beneficiarioId))) {
      return res.status(400).json({ error: 'El beneficiario indicado no es válido' });
    }
    if (
      fechaCaducidad &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCaducidad) || Number.isNaN(Date.parse(fechaCaducidad)))
    ) {
      return res.status(400).json({ error: 'La fecha de caducidad no es válida (usa AAAA-MM-DD)' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'La imagen del producto es obligatoria' });
    }

    const esPerecedero = perecedero === 'true' || perecedero === true;

    if (beneficiarioId) {
      const existe = await Beneficiary.findByPk(Number(beneficiarioId));
      if (!existe) {
        return res.status(400).json({ error: 'El beneficiario indicado no existe' });
      }
    }

    const donacion = await Donation.create({
      producto,
      categoria,
      cantidad: cantidadNum,
      peso: pesoNum,
      perecedero: esPerecedero,
      fechaCaducidad: esPerecedero ? fechaCaducidad : null,
      beneficiarioId: beneficiarioId ? Number(beneficiarioId) : null,
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