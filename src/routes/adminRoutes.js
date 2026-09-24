const router = require('express').Router();
const { verificarToken, permitirRoles } = require('../middleware/auth');
const adminDonations = require('../controllers/adminDonationController');
const beneficiaries = require('../controllers/beneficiaryController');
const collectors = require('../controllers/collectorController');

router.use(verificarToken, permitirRoles('admin'));

router.get('/donations', adminDonations.listarTodas);
router.patch('/donations/:id/decidir', adminDonations.decidir);
router.patch('/donations/:id/estado', adminDonations.cambiarEstado);

router.get('/beneficiaries', beneficiaries.listar);
router.post('/beneficiaries', beneficiaries.crear);
router.put('/beneficiaries/:id', beneficiaries.actualizar);
router.delete('/beneficiaries/:id', beneficiaries.eliminar);

router.get('/collectors', collectors.listar);

module.exports = router;