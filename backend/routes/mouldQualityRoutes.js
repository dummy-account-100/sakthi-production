const express = require('express');
const router = express.Router();
const controller = require('../controllers/mouldQualityController');

router.get('/users', controller.getUsers);
router.post('/add', controller.saveReport);
router.get('/report', controller.generateReport);
router.get('/supervisor/:name', controller.getSupervisorReports);
router.post('/sign-supervisor', controller.signSupervisor);

module.exports = router;