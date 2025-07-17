// appointmentRoutes.js
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Ensure these functions are valid
router.post('/', appointmentController.createAppointment);
router.get('/', appointmentController.getAppointments);
router.put('/:id', appointmentController.updateAppointmentStatus);

module.exports = router;




