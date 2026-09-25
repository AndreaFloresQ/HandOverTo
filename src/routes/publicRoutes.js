const router = require('express').Router();
const { listarBeneficiarios } = require('../controllers/publicController');

router.get('/beneficiaries', listarBeneficiarios);

module.exports = router;