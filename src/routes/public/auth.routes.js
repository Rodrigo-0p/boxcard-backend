// routes/modulos/auth.routes.js
const express        = require('express');
const router         = express.Router();
const authController = require('../../controllers/public/auth.controllers');

// rutaBase
const base_ruta = '/public';

module.exports = ()=>{
  
  // Login con username, password y nro_documento
  router.post(`${base_ruta}/login`, authController.login);

  return router;
}