const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const donationRoutes = require('./routes/donationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const { verificarToken, permitirRoles } = require('./middleware/auth');

const app = express();

// No revelar la tecnología del servidor
app.disable('x-powered-by');

// Cabeceras de seguridad (CSP, anti-clickjacking, nosniff, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { 'upgrade-insecure-requests': null }, // la app corre en http en desarrollo
    },
    crossOriginEmbedderPolicy: true,
  })
);

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// CORS cerrado por defecto: el frontend se sirve desde el mismo origen.
// Si algún día lo separas, define CORS_ORIGIN=https://tu-frontend en el .env
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json());

// Express 5 deja req.body sin definir cuando la petición no trae cuerpo
app.use((req, res, next) => {
  req.body = req.body ?? {};
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Las respuestas de la API nunca deben guardarse en caché
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Rutas temporales para probar roles (van antes de los routers)
app.get('/api/admin/ping', verificarToken, permitirRoles('admin'), (req, res) =>
  res.json({ mensaje: 'Hola, admin' })
);
app.get('/api/donador/ping', verificarToken, permitirRoles('donador'), (req, res) =>
  res.json({ mensaje: 'Hola, donador' })
);

app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Cualquier ruta inexistente responde en JSON
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// Manejador de errores (subida de archivos y errores no controlados)
app.use((err, req, res, next) => {
  if (err.name === 'MulterError' || err.message?.startsWith('Solo se permiten')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Error del servidor' });
});

module.exports = app;