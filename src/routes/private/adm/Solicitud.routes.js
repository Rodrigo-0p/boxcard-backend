const express = require('express');
const router = express.Router();

const solReporte = require('../../../controllers/private/adm/solicitud/ReporteSolicitud.controller');
const solList = require('../../../controllers/private/base/solicitud/ListSolicitud.controller');
const solApprove = require('../../../controllers/private/base/solicitud/ApproveSolicitud.controller');
const solReject = require('../../../controllers/private/base/solicitud/RejectSolicitud.controller');
const solDetalle = require('../../../controllers/private/base/solicitud/GetSolicitudDetails.controller');
const { strictLimiter, apiLimiter } = require('../../../middleware/rateLimiters');
const { upload } = require('../../../middleware/middleware');

const adm_ruta = '/adm/solicitud';

module.exports = () => {
    router.get(`${adm_ruta}/reporte`, apiLimiter, solReporte.main);
    router.get(`${adm_ruta}/listar`, solList.main);
    router.post(`${adm_ruta}/aprobar`, strictLimiter, upload.single('comprobante'), solApprove.main);
    router.post(`${adm_ruta}/rechazar`, strictLimiter, solReject.main);
    router.get(`${adm_ruta}/detalles/:cod_solicitud`, solDetalle.main);

    return router;
};
