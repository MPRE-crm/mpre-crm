const express = require('express');
const router = express.Router();

// Import userController (this should match the correct path)
const userController = require('../controllers/userController');

// Log to check if userController is loaded correctly
console.log('userController:', userController);  // This will log the functions in userController

// Define routes
router.post('/', userController.createUser);  // This should reference the function in userController
router.get('/', userController.getUsers);    // This should reference the function in userController

module.exports = router;



















