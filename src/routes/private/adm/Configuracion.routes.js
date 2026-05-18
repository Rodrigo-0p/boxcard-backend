const express = require('express');
const router = express.Router();

const listMenus = require('../../../controllers/private/adm/configuracion/ListMenus.controller');
const saveMenu = require('../../../controllers/private/adm/configuracion/SaveMenu.controller');
const deleteMenu = require('../../../controllers/private/adm/configuracion/DeleteMenu.controller');
const listRoles = require('../../../controllers/private/adm/configuracion/ListRoles.controller');
const roleMenus = require('../../../controllers/private/adm/configuracion/RoleMenus.controller');
const { strictLimiter } = require('../../../middleware/rateLimiters');

const base_ruta = '/adm/configuracion';

module.exports = () => {
    router.get(`${base_ruta}/menus/listar`, listMenus.main);
    router.post(`${base_ruta}/menus/guardar`, strictLimiter, saveMenu.main);
    router.post(`${base_ruta}/menus/eliminar`, strictLimiter, deleteMenu.main);
    
    router.get(`${base_ruta}/roles/listar`, listRoles.main);
    router.get(`${base_ruta}/roles/menus/:cod_role`, roleMenus.getRoleMenus);
    router.post(`${base_ruta}/roles/menus/guardar`, strictLimiter, roleMenus.saveRoleMenus);
    router.post(`${base_ruta}/roles/menus/guardar-bulk`, strictLimiter, roleMenus.saveBulkRoleMenus);
    
    // Permisos Especiales
    const specials = require('../../../controllers/private/adm/configuracion/SpecialPermissions.controller');
    router.get(`${base_ruta}/especiales/listar`, specials.list);
    router.post(`${base_ruta}/especiales/guardar`, strictLimiter, specials.save);
    router.post(`${base_ruta}/especiales/guardar-bulk`, strictLimiter, specials.bulkSave);
    router.post(`${base_ruta}/especiales/eliminar`, strictLimiter, specials.delete);
    
    return router;
};
