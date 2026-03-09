const express = require('express');
const router = express.Router();

const solList = require('../../../controllers/private/adm/solicitud/ListSolicitud.controller');
const solInsert = require('../../../controllers/private/adm/solicitud/CreateSolicitud.controller');
const solUpdate = require('../../../controllers/private/adm/solicitud/UpdateSolicitud.controller');
const solDelete = require('../../../controllers/private/adm/solicitud/DeleteSolicitud.controller');
const solApprove = require('../../../controllers/private/adm/solicitud/ApproveSolicitud.controller');
const solSend = require('../../../controllers/private/adm/solicitud/SendSolicitud.controller');
const solReject = require('../../../controllers/private/adm/solicitud/RejectSolicitud.controller');
const solDetalle = require('../../../controllers/private/adm/solicitud/GetSolicitudDetails.controller');
const { strictLimiter } = require('../../../middleware/rateLimiters');

const base_ruta = '/adm/solicitud';

module.exports = () => {
    router.get(`${base_ruta}/listar`, solList.main);
    router.post(`${base_ruta}/insert`, strictLimiter, solInsert.main);
    router.post(`${base_ruta}/update`, strictLimiter, solUpdate.main);
    router.post(`${base_ruta}/delete`, strictLimiter, solDelete.main);
    router.post(`${base_ruta}/aprobar`, strictLimiter, solApprove.main);
    router.post(`${base_ruta}/enviar`, strictLimiter, solSend.main);
    router.post(`${base_ruta}/rechazar`, strictLimiter, solReject.main);
    router.get(`${base_ruta}/detalles/:cod_solicitud`, solDetalle.main);

    return router;
};
