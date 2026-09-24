const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

function sinPassword(usuario) {
  const { password, ...datos } = usuario.toJSON();
  return datos;
}

async function registrar(req, res) {
  try {
    const { nombre, empresa, direccion, ciudad, telefono, correo, password } = req.body;

    if (!nombre || !direccion || !ciudad || !telefono || !correo || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existe = await User.findOne({ where: { correo } });
    if (existe) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    // El rol NO se toma del body: todo registro público es donador
    const usuario = await User.create({
      nombre,
      empresa,
      direccion,
      ciudad,
      telefono,
      correo,
      password: await bcrypt.hash(password, 10),
    });

    res.status(201).json({ mensaje: 'Cuenta creada', usuario: sinPassword(usuario) });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function login(req, res) {
  try {
    const { correo, password } = req.body;

    if (typeof correo !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const usuario = await User.findOne({ where: { correo } });
    const valido = usuario && (await bcrypt.compare(password, usuario.password));

    // Mismo mensaje si falla el correo o la contraseña, para no dar pistas
    if (!valido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token, usuario: sinPassword(usuario) });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

async function perfil(req, res) {
  try {
    const usuario = await User.findByPk(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(sinPassword(usuario));
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
}

module.exports = { registrar, login, perfil };