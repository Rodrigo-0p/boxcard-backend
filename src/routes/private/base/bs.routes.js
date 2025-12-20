const express = require('express');
const router  = express.Router();
const menuController   = require('../../../controllers/private/base/menu.controllers');
const changeEmpresa    = require('../../../controllers/private/base/changeEmpr.controllers');
const verificaPermisos = require('../../../controllers/private/base/permisos.controllers');

const base_ruta = '/bs';

module.exports = () => {
  router.get( `${base_ruta}/menus`        , menuController.main         );
  router.get( `${base_ruta}/infoEmpresas` , changeEmpresa.main          );  
  router.post(`${base_ruta}/updateEmpresa`, changeEmpresa.updateEmpresa );
  router.post(`${base_ruta}/verPermisos`  , verificaPermisos.main       );
  return router;
};