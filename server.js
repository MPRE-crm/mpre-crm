require('dotenv').config();  // Ensure dotenv is loaded

const express = require('express');
const app = express();

// Import routes
const appointmentRoutes = require('./src/app/routes/appointmentRoutes');
const userRoutes = require('./src/app/routes/userRoutes');  // Correctly import userRoutes
const availabilityRoutes = require('./src/app/routes/availabilityRoutes');

// Middleware for parsing JSON bodies
app.use(express.json());

// Log to check if userRoutes is imported correctly
console.log('User Routes:', userRoutes);  // Log to verify the routes

// Use the routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);  // This handles /api/users route
app.use('/api/availability', availabilityRoutes);

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});












