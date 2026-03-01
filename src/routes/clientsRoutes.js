const express = require('express');
const requireInternalApiKey = require('../middleware/authInternal');
const clientsController = require('../controllers/clientsController');

const router = express.Router();

router.post(
  '/clients',
  requireInternalApiKey,
  clientsController.registerClientValidation,
  clientsController.registerClient
);

module.exports = router;
