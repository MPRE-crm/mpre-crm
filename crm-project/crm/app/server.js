// src/app/server.js
const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');
const googleAuthRoutes = require('./routes/googleAuth');  // Import routes from googleAuth.js
const calendarRoutes = require('./routes/calendarRoutes');  // Import routes for calendar actions

// 🔹 FIX: correct relative path to opening.js
const SAMANTHA_OPENING_TRIAGE = require('./lib/prompts/opening.js');

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Routes
app.use('/api', googleAuthRoutes);
app.use('/calendar', calendarRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
