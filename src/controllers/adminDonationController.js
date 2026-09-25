const { Donation, User, Beneficiary, Collector, Notification } = require('../models');
const { ESTADOS } = require('../config/constantes');


async function listarTodas(req, res) {
  try {
    const { estado } = req.query;
    const where = estado ? { estado } : {};

    const donaciones = await Donation.findAll({
      where,
      include: [
        { model: User, as: 'donador', attributes: ['id', 'nombre', 'ciudad'] },
        { model: Beneficiary, as: 'beneficiario', attributes: ['id', 'nombre'] },
        { model: Collector, as: 'recolector', attributes: ['id', 'nombre', 'vehiculo'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    // El campo urgencia es virtual, así que se incluye solo al convertir a JSON
    res.json(donaciones.map((d) => d.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function decidir(req, res) {
  try {
    const donacion = await Donation.findByPk(req.params.id);
    if (!donacion) return res.status(404).json({ error: 'Donación no encontrada' });

    if (donacion.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Esta donación ya fue procesada' });
    }

    const { accion, beneficiarioId, recolectorId, motivoRechazo } = req.body;

    if (accion === 'rechazar') {
      if (!motivoRechazo) {
        return res.status(400).json({ error: 'El motivo de rechazo es obligatorio' });
      }
      donacion.estado = 'rechazada';
      donacion.motivoRechazo = motivoRechazo;
      await donacion.save();

      await Notification.create({
        userId: donacion.donadorId,
        mensaje: `Tu donación de "${donacion.producto}" fue rechazada. Motivo: ${motivoRechazo}`,
      });
      return res.json({ mensaje: 'Donación rechazada', donacion });
    }

    if (accion === 'aprobar') {
      if (!recolectorId) {
        return res.status(400).json({ error: 'Debes asignar un recolector' });
      }

      const recolector = await Collector.findByPk(recolectorId);
      if (!recolector) return res.status(400).json({ error: 'Recolector no encontrado' });
      if (donacion.peso > recolector.capacidadKg) {
        return res.status(400).json({
          error: `El peso (${donacion.peso}kg) excede la capacidad del vehículo (${recolector.capacidadKg}kg)`,
        });
      }

      // El beneficiario es obligatorio: si el donador no eligió uno, el admin debe hacerlo ahora
      const idFinal = beneficiarioId || donacion.beneficiarioId;
      if (!idFinal) {
        return res.status(400).json({ error: 'Debes asignar un beneficiario antes de aprobar' });
      }

      const beneficiario = await Beneficiary.findByPk(idFinal);
      if (!beneficiario) return res.status(400).json({ error: 'Beneficiario no encontrado' });

      donacion.beneficiarioId = idFinal;
      donacion.recolectorId = recolectorId;
      donacion.estado = 'en_camino';
      await donacion.save();

      await Notification.create({
        userId: donacion.donadorId,
        mensaje: `Tu donación de "${donacion.producto}" fue aprobada y está en camino a ser recolectada`,
      });
      return res.json({ mensaje: 'Donación aprobada', donacion });
    }

    return res.status(400).json({ error: 'Acción inválida (usa "aprobar" o "rechazar")' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function cambiarEstado(req, res) {
  try {
    const { estado } = req.body;
    const permitidos = ['en_transito', 'entregada'];

    if (!permitidos.includes(estado)) {
      return res.status(400).json({ error: `El estado debe ser uno de: ${permitidos.join(', ')}` });
    }

    const donacion = await Donation.findByPk(req.params.id);
    if (!donacion) return res.status(404).json({ error: 'Donación no encontrada' });

    if (donacion.estado === 'entregada' || donacion.estado === 'rechazada') {
      return res.status(400).json({ error: 'Esta donación ya no se puede modificar' });
    }

    // Segunda capa de seguridad: nunca avanzar sin beneficiario definido
    if (!donacion.beneficiarioId) {
      return res.status(400).json({ error: 'No se puede avanzar el estado sin un beneficiario asignado' });
    }

    donacion.estado = estado;
    await donacion.save();

    await Notification.create({
      userId: donacion.donadorId,
      mensaje: `Tu donación de "${donacion.producto}" cambió de estado a: ${estado.replace('_', ' ')}`,
    });

    res.json({ mensaje: 'Estado actualizado', donacion });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function asignarBeneficiario(req, res) {
  try {
    const { beneficiarioId } = req.body;
    if (!beneficiarioId) {
      return res.status(400).json({ error: 'Debes indicar un beneficiario' });
    }

    const donacion = await Donation.findByPk(req.params.id);
    if (!donacion) return res.status(404).json({ error: 'Donación no encontrada' });

    if (donacion.estado === 'entregada' || donacion.estado === 'rechazada') {
      return res.status(400).json({ error: 'Esta donación ya no se puede modificar' });
    }

    const beneficiario = await Beneficiary.findByPk(beneficiarioId);
    if (!beneficiario) return res.status(400).json({ error: 'Beneficiario no encontrado' });

    donacion.beneficiarioId = beneficiarioId;
    await donacion.save();

    res.json({ mensaje: 'Beneficiario asignado', donacion });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

module.exports = { listarTodas, decidir, cambiarEstado, asignarBeneficiario };