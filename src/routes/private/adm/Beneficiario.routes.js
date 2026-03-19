const express = require('express');
const router = express.Router();

const benList = require('../../../controllers/private/base/beneficiario/ListBeneficiario.controller');
const benInsert = require('../../../controllers/private/base/beneficiario/CreateBeneficiario.controller');
const benUpdate = require('../../../controllers/private/base/beneficiario/UpdateBeneficiario.controller');
const benDelete = require('../../../controllers/private/base/beneficiario/DeleteBeneficiario.controller');
const benBulk = require('../../../controllers/private/base/beneficiario/CargaMasiva.controller');
const benPrevalidar = require('../../../controllers/private/base/beneficiario/PrevalidarCarga.controller');
const benAprobar = require('../../../controllers/private/base/beneficiario/ApproveBeneficiario.controller');

const { strictLimiter } = require('../../../middleware/rateLimiters');

const adm_ruta = '/adm/beneficiario';

module.exports = () => {
    router.get(`${adm_ruta}/listar`, benList.main);
    router.post(`${adm_ruta}/insert`, strictLimiter, benInsert.main);
    router.post(`${adm_ruta}/update`, strictLimiter, benUpdate.main);
    router.post(`${adm_ruta}/delete`, strictLimiter, benDelete.main);
    router.post(`${adm_ruta}/carga-masiva`, strictLimiter, benBulk.main);
    router.post(`${adm_ruta}/prevalidar`, strictLimiter, benPrevalidar.main);
    router.post(`${adm_ruta}/aprobar`, strictLimiter, benAprobar.main);

    return router;
};
