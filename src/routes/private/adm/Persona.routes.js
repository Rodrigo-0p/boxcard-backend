const express       = require('express');

const router        = express.Router();
const perosnalist   = require('../../../controllers/private/adm/persona/ListPersona.controller'   );
const perosnaInsert = require('../../../controllers/private/adm/persona/CreatePersona.controller' );
const perosnaUpdate = require('../../../controllers/private/adm/persona/UpdatePersona.controller' );
const perosnaDelete = require('../../../controllers/private/adm/persona/DeletePerosona.controller');
// GET
const listRoles     = require('../../../controllers/private/adm/persona/getLIst/getRoles'       );
const listEmpresa   = require('../../../controllers/private/adm/persona/getLIst/getEmpresas'    );
const listMenu      = require('../../../controllers/private/adm/persona/getLIst/getMenu'        );
const listMenuPers  = require('../../../controllers/private/adm/persona/getLIst/getmenuspersona');

const base_ruta     = '/adm/persona';

module.exports = () => {
  router.get ( `${base_ruta}/listar`       , perosnalist.main );
  router.get ( `${base_ruta}/empresas`     , listEmpresa.main );
  router.get ( `${base_ruta}/roles`        , listRoles.main   );
  router.get ( `${base_ruta}/menus`        , listMenu.main    );  
  router.get ( `${base_ruta}/menus-persona`, listMenuPers.main);  
  
  
  router.post( `${base_ruta}/delete`  , perosnaDelete.main );
  router.post( `${base_ruta}/insert`  , perosnaInsert.main );
  router.post( `${base_ruta}/update`  , perosnaUpdate.main );  
  
  return router;
};