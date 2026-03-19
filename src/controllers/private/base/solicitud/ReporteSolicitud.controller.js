const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    const user = req.user;
    try {
        const { fecha_desde, fecha_hasta, estado, cod_empresa } = req.query;
        
        // Filtro base por estado (Solo finalizados: Confirmados, Rechazados, Anulados)
        // O si el usuario pide uno específico
        let whereClause = "sc.estado IN ('C', 'R', 'A')";
        let finalParams = [];
        let paramIndex = 1;

        if (estado && estado !== 'all') {
            whereClause = "sc.estado = $" + paramIndex;
            finalParams.push(estado);
            paramIndex++;
        }

        // Filtro por empresa (Si no es super administrador, solo ve su empresa)
        if (user.role !== 'rol_super_adm') {
            whereClause += ` AND sc.cod_empresa = $${paramIndex}`;
            finalParams.push(user.cod_empresa);
            paramIndex++;
        } else if (cod_empresa && cod_empresa !== 'all') {
            whereClause += ` AND sc.cod_empresa = $${paramIndex}`;
            finalParams.push(cod_empresa);
            paramIndex++;
        }

        // Filtro por fecha
        if (fecha_desde && fecha_hasta) {
            whereClause += ` AND sc.fecha_creacion::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            finalParams.push(fecha_desde);
            finalParams.push(fecha_hasta);
            paramIndex += 2;
        }

        const sqlQuery = `
            SELECT sc.cod_solicitud
                 , sc.nro_solicitud
                 , sc.cod_empresa
                 , e.nombre as nombre_empresa
                 , e.ruc as ruc_empresa
                 , sc.descripcion
                 , sc.monto_solicitado
                 , sc.cant_beneficiarios
                 , sc.estado
                 , sc.usuario_creacion
                 , (SELECT p.descripcion FROM personas p WHERE p.usuario_pg = sc.usuario_creacion LIMIT 1) as solicitante_nombre
                 , sc.fecha_creacion
                 , sc.usuario_confirmacion
                 , (SELECT p.descripcion FROM personas p WHERE p.usuario_pg = sc.usuario_confirmacion LIMIT 1) as usuario_confirmacion_nombre
                 , sc.fecha_confirmacion
                 , sc.motivo_rechazo
                 , sc.nro_comprobante
                 , sc.url_comprobante
                 , e_dest.nombre as nombre_empresa_dest
              FROM solicitudes_carga sc
              JOIN empresas e ON sc.cod_empresa = e.cod_empresa
              JOIN empresas e_dest ON sc.cod_empresa_destino = e_dest.cod_empresa
             WHERE ${whereClause}
             ORDER BY sc.fecha_creacion DESC
        `;

        const result = await executeQueryWithSession(user, sqlQuery, finalParams);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: result.message || 'Error al generar reporte de solicitudes'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error en ReporteSolicitud:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al generar el reporte'
        });
    }
};
