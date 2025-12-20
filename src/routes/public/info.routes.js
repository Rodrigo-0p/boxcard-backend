const express  = require('express');
const router   = express.Router();
const mainInfo = require('../../controllers/public/InfoContacto.controllers');

// rutaBase
const base_ruta = '/public';

module.exports = ()=>{
  // Ruta pública sin autenticación
  router.get(`${base_ruta}/info-contacto`, mainInfo.main);
  return router;
}