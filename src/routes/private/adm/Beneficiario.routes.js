const express = require('express');
const router = express.Router();

const benefList = require('../../../controllers/private/adm/beneficiario/ListBeneficiario.controller');
const benefInsert = require('../../../controllers/private/adm/beneficiario/CreateBeneficiario.controller');
const benefUpdate = require('../../../controllers/private/adm/beneficiario/UpdateBeneficiario.controller');
const benefDelete = require('../../../controllers/private/adm/beneficiario/DeleteBeneficiario.controller');
const benefBuscar = require('../../../controllers/private/adm/beneficiario/BuscarPersona.controller');
const benefCarga = require('../../../controllers/private/adm/beneficiario/CargaMasiva.controller');
const benefPrevalidar = require('../../../controllers/private/adm/beneficiario/PrevalidarCarga.controller');
const benefApprove = require('../../../controllers/private/adm/beneficiario/ApproveBeneficiario.controller');
const benefSeed = require('../../../controllers/private/adm/beneficiario/SeedBeneficiarios.controller');
const { strictLimiter } = require('../../../middleware/rateLimiters');

const base_ruta = '/adm/beneficiario';

module.exports = () => {
    // GET
    router.get(`${base_ruta}/listar`, benefList.main);
    router.get(`${base_ruta}/buscar-persona`, benefBuscar.main);

    // POST
    router.post(`${base_ruta}/insert`, strictLimiter, benefInsert.main);
    router.post(`${base_ruta}/update`, strictLimiter, benefUpdate.main);
    router.post(`${base_ruta}/delete`, strictLimiter, benefDelete.main);
    router.post(`${base_ruta}/carga-masiva`, strictLimiter, benefCarga.main);
    router.post(`${base_ruta}/prevalidar-carga`, strictLimiter, benefPrevalidar.main);
    router.post(`${base_ruta}/aprobar`, strictLimiter, benefApprove.main);
    router.post(`${base_ruta}/seed`, strictLimiter, benefSeed.main);

    return router;
};
