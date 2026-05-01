const express = require('express');
const router = express.Router();
const controller = require('../controllers/mouldQualityController');

// --- Dropdowns & Helpers ---
router.get('/users', controller.getUsers);
router.get('/components', controller.getComponents);

// --- Core App Operations ---
router.get('/check', controller.checkExisting);     // <-- Fixed: Removed the /mould-quality prefix
router.post('/add', controller.saveReport);
router.put('/update/:id', controller.updateReport); // <-- Fixed: Removed duplicate and prefix

// --- Supervisor & Reports ---
router.get('/supervisor/:name', controller.getSupervisorReports);
router.post('/sign-supervisor', controller.signSupervisor);
router.get('/report', controller.generateReport);

// --- Admin & Bulk Data ---
router.get('/by-date', controller.getByDate);
router.get('/bulk-data', controller.getBulkData);

module.exports = router;