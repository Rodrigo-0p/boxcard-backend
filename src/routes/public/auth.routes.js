// routes/modulos/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/public/auth.controllers');
const { loginLimiter, passwordChangeLimiter } = require('../../middleware/rateLimiters');

// rutaBase
const base_ruta = '/public';

module.exports = () => {

  // Login con username, password y nro_documento
  router.post(`${base_ruta}/login`, authController.login);

  // Cambiar contraseña temporal (sin token jwt)
  router.post(`${base_ruta}/cambiar-password-temporal`, authController.cambiarPasswordTemporal);

  return router;
}