const express = require('express');
const router = express.Router();
const delayController = require('../controllers/delayController');

router.get('/', delayController.getAllDelays);
router.post('/add', delayController.addDelay);
router.put('/:id', delayController.updateDelay);
router.delete('/:id', delayController.deleteDelay);

module.exports = router;