const express = require('express');
const router = express.Router();

const solList = require('../../../controllers/private/base/solicitud/ListSolicitud.controller');
const solInsert = require('../../../controllers/private/base/solicitud/CreateSolicitud.controller');
const solUpdate = require('../../../controllers/private/base/solicitud/UpdateSolicitud.controller');
const solDelete = require('../../../controllers/private/base/solicitud/DeleteSolicitud.controller');
const solApprove = require('../../../controllers/private/base/solicitud/ApproveSolicitud.controller');
const solSend = require('../../../controllers/private/base/solicitud/SendSolicitud.controller');
const solReject = require('../../../controllers/private/base/solicitud/RejectSolicitud.controller');
const solDetalle = require('../../../controllers/private/base/solicitud/GetSolicitudDetails.controller');
const solReporte = require('../../../controllers/private/base/solicitud/ReporteSolicitud.controller'); // Added
const { strictLimiter, apiLimiter } = require('../../../middleware/rateLimiters');
const { upload } = require('../../../middleware/middleware');

const base_ruta = '/base/solicitud';

module.exports = () => {
    router.get(`${base_ruta}/listar`, solList.main);
    router.post(`${base_ruta}/insert`, strictLimiter, solInsert.main);
    router.post(`${base_ruta}/update`, strictLimiter, solUpdate.main);
    router.post(`${base_ruta}/delete`, strictLimiter, solDelete.main);
    router.post(`${base_ruta}/aprobar`, strictLimiter, upload.single('comprobante'), solApprove.main);
    router.post(`${base_ruta}/enviar`, strictLimiter, solSend.main);
    router.post(`${base_ruta}/rechazar`, strictLimiter, solReject.main);
    router.get(`${base_ruta}/detalles/:cod_solicitud`, solDetalle.main);
    router.get(`${base_ruta}/reporte`, apiLimiter, solReporte.main); 

    return router;
};
