const express = require('express');
const router = express.Router();
const controller = require('../controllers/mouldQualityController');

router.get('/users', controller.getUsers);
router.post('/add', controller.saveReport);
router.get('/report', controller.generateReport);
router.get('/supervisor/:name', controller.getSupervisorReports);
router.post('/sign-supervisor', controller.signSupervisor);
router.get('/components', controller.getComponents);

router.get('/by-date', controller.getByDate);
router.put('/update/:id', controller.updateReport);
router.get('/bulk-data', controller.getBulkData);

module.exports = router;