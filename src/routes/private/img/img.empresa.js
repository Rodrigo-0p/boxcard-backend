const express   = require('express');
const router    = express.Router();
const base_ruta = '/img/logempresa';

const imgController = require('../../../controllers/private/img/img.empresa.controller');

module.exports = () => {
  router.get( `${base_ruta}`, imgController.main);
  return router;
};