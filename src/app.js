const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const { verificarToken, permitirRoles } = require('./middleware/auth');
const donationRoutes = require('./routes/donationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/admin', adminRoutes);

// Rutas temporales para probar roles
app.get('/api/admin/ping', verificarToken, permitirRoles('admin'), (req, res) =>
  res.json({ mensaje: 'Hola, admin' })
);
app.get('/api/donador/ping', verificarToken, permitirRoles('donador'), (req, res) =>
  res.json({ mensaje: 'Hola, donador' })
);

module.exports = app;
