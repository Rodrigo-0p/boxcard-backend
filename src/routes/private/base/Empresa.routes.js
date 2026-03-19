const express = require('express');
const router = express.Router();

// Usamos los mismos controladores que ADM pero bajo el prefijo /base
const empresaStatus = require('../../../controllers/private/adm/empresa/GetEmpresaStatus');
const empresaList = require('../../../controllers/private/adm/empresa/ListEmpresa.controller');

const base_ruta = '/base/empresa';

module.exports = () => {
    // Obtener estado de cupo y límites de la empresa del usuario actual
    router.get(`${base_ruta}/status`, empresaStatus.main);
    
    // Listar empresas proveedoras o asociadas
    router.get(`${base_ruta}/listar_proveedores`, empresaList.main);

    return router;
};
