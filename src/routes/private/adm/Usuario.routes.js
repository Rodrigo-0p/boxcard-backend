const express = require('express');
const router = express.Router();
const usuarioList = require('../../../controllers/private/adm/usuario/ListUsuario.controller');
const usuarioInsert = require('../../../controllers/private/adm/usuario/CreateUsuario.controller');
const usuarioUpdate = require('../../../controllers/private/adm/usuario/UpdateUsuario.controller');
const usuarioDelete = require('../../../controllers/private/adm/usuario/DeleteUsuario.controller');

// Reusamos los listados de Persona ya que son genéricos
const listRoles = require('../../../controllers/private/adm/persona/getLIst/getRoles');
const listEmpresa = require('../../../controllers/private/adm/persona/getLIst/getEmpresas');
const listMenu = require('../../../controllers/private/adm/persona/getLIst/getMenu');
const listMenuPers = require('../../../controllers/private/adm/persona/getLIst/getmenuspersona');

const base_ruta = '/adm/usuario';

module.exports = () => {
    router.get(`${base_ruta}/listar`, usuarioList.main);
    router.get(`${base_ruta}/empresas`, listEmpresa.main);
    router.get(`${base_ruta}/roles`, listRoles.main);
    router.get(`${base_ruta}/menus`, listMenu.main);
    router.get(`${base_ruta}/menus-persona`, listMenuPers.main);

    router.post(`${base_ruta}/delete`, usuarioDelete.main);
    router.post(`${base_ruta}/insert`, usuarioInsert.main);
    router.post(`${base_ruta}/update`, usuarioUpdate.main);

    return router;
};
