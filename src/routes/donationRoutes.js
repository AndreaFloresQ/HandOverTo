const router = require('express').Router();
const upload = require('../middleware/upload');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const {
  crear,
  misDonaciones,
  misNotificaciones,
  marcarNotificacionLeida,
} = require('../controllers/donationController');

router.use(verificarToken, permitirRoles('donador'));

router.post('/', upload.single('imagen'), crear);
router.get('/mias', misDonaciones);
router.get('/notificaciones', misNotificaciones);
router.patch('/notificaciones/:id/leida', marcarNotificacionLeida);

module.exports = router;