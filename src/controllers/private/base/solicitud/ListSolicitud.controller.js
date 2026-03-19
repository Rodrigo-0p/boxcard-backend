const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    const user = req.user;
    try {
        const { tipo } = req.query;
        const isConfirmar = tipo === 'confirmar';

        // Lógica de filtrado estricta:
        let whereClause = "";
        let finalParams = [];

        if (isConfirmar) {
            // REQUERIMIENTO: Solo pendientes destinados a la empresa logueada (proveedor).
            if (user.role === 'rol_super_adm') {
                whereClause = "sc.estado = 'P'";
                finalParams = [];
            } else {
                whereClause = "sc.estado = 'P' AND sc.cod_empresa_destino = $1";
                finalParams = [user.cod_empresa];
            }
        } else {
            // Vista normal (Mis solicitudes): 
            // Si es superadm ve todos. Si es usuario normal solo los de su empresa.
            if (user.role === 'rol_super_adm') {
                whereClause = "1=1";
                finalParams = [];
            } else {
                whereClause = "sc.cod_empresa = $1";
                finalParams = [user.cod_empresa];
            }
        }

        const sqlQuery = `
      SELECT sc.cod_solicitud
           , sc.nro_solicitud
           , sc.cod_empresa
           , e.nombre as nombre_empresa
           , e.ruc as ruc_empresa
           , e.tip_empresa
           , e.modalidad
           , COALESCE(e.limite_credito, 0) as limite_credito
           , (SELECT COALESCE(SUM(monto_solicitado), 0) FROM solicitudes_carga WHERE cod_empresa = e.cod_empresa AND estado IN ('C', 'P')) as cupo_asignado
           , sc.descripcion
           , sc.observaciones
           , sc.monto_solicitado
           , sc.cant_beneficiarios
           , sc.estado
           , sc.usuario_creacion
           , sc.usuario_creacion as solicitante_username
           , (SELECT p.descripcion FROM personas p WHERE p.usuario_pg = sc.usuario_creacion LIMIT 1) as solicitante_nombre
           , sc.fecha_creacion
           , sc.usuario_confirmacion
           , (SELECT p.descripcion FROM personas p WHERE p.usuario_pg = sc.usuario_confirmacion LIMIT 1) as usuario_confirmacion_nombre
           , sc.fecha_confirmacion
           , sc.motivo_rechazo
           , sc.nro_comprobante
           , sc.url_comprobante
         FROM solicitudes_carga sc
         JOIN empresas e ON sc.cod_empresa = e.cod_empresa
        WHERE ${whereClause}
        ORDER BY sc.fecha_creacion DESC
    `;

        const result = await executeQueryWithSession(user, sqlQuery, finalParams);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: result.message || 'Error al listar solicitudes'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error listando solicitudes:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al listar solicitudes'
        });
    }
};
