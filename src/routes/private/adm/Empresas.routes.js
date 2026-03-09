const express = require('express');
const { upload } = require('../../../middleware/middleware');
const router = express.Router();
const empresalist = require('../../../controllers/private/adm/empresa/ListEmpresa.controller');
const empresaInsert = require('../../../controllers/private/adm/empresa/CreateEmpresa.controller');
const empresaDelete = require('../../../controllers/private/adm/empresa/DeleteEmpresa.controller');
const empresaUpdate = require('../../../controllers/private/adm/empresa/UpdateEmpresa.controller');
const empresaStatus = require('../../../controllers/private/adm/empresa/GetEmpresaStatus');
const base_ruta = '/adm/empresa';

module.exports = () => {
  router.get(`${base_ruta}/listar`, empresalist.main);
  router.get(`${base_ruta}/status`, empresaStatus.main);
  router.post(`${base_ruta}/delete`, empresaDelete.main);
  router.post(`${base_ruta}/insert`, upload.single('logo'), empresaInsert.main);
  router.post(`${base_ruta}/update`, upload.single('logo'), empresaUpdate.main);
  return router;
};