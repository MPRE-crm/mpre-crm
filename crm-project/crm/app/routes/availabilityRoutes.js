// availabilityRoutes.js
const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');

// Routes for availability
router.post('/', availabilityController.createAvailability);
router.get('/:agent_id', availabilityController.getAvailability);

module.exports = router;


