const router = require('express').Router();
const { registrar, login, perfil } = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');

router.post('/register', registrar);
router.post('/login', login);
router.get('/me', verificarToken, perfil);

module.exports = router;