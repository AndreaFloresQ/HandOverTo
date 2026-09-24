const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (req, file, cb) => {
    const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unico}${path.extname(file.originalname)}`);
  },
});

const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];

function filtro(req, file, cb) {
  if (!tiposPermitidos.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: filtro,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

module.exports = upload;