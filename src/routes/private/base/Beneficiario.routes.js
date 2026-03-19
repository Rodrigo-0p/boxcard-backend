const express = require('express');
const router = express.Router();

const benefList = require('../../../controllers/private/base/beneficiario/ListBeneficiario.controller');
const benefInsert = require('../../../controllers/private/base/beneficiario/CreateBeneficiario.controller');
const benefUpdate = require('../../../controllers/private/base/beneficiario/UpdateBeneficiario.controller');
const benefDelete = require('../../../controllers/private/base/beneficiario/DeleteBeneficiario.controller');
const benefBuscar = require('../../../controllers/private/base/beneficiario/BuscarPersona.controller');
const benefCarga = require('../../../controllers/private/base/beneficiario/CargaMasiva.controller');
const benefPrevalidar = require('../../../controllers/private/base/beneficiario/PrevalidarCarga.controller');
const benefApprove = require('../../../controllers/private/base/beneficiario/ApproveBeneficiario.controller');
const benefSeed = require('../../../controllers/private/base/beneficiario/SeedBeneficiarios.controller');
const { strictLimiter } = require('../../../middleware/rateLimiters');

const base_ruta = '/base/beneficiario';

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
