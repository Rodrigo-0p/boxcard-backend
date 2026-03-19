const { executeQueryWithSession } = require('../../../config/database');
const { log_error } = require('../../../log/logger');
const moment = require('moment');

exports.getStats = async (req, res) => {
    try {
        const user = req.user;
        const cod_empresa = parseInt(user.cod_empresa);

        const sqlQuery = `
            SELECT 
                (select count(*) from nominas_benef where cod_empresa = $1 and estado != 'E') as total_beneficiarios,
                (select count(*) from solicitudes_carga where cod_empresa = $1) as total_solicitudes,
                (select COALESCE(SUM(monto_solicitado), 0) FROM solicitudes_carga where cod_empresa = $1 and estado = 'C') as monto_total_confirmado,
                COALESCE(e.limite_credito, 0) as limite_credito,
                (select COALESCE(SUM(monto_solicitado), 0) FROM solicitudes_carga where cod_empresa = e.cod_empresa AND estado IN ('C', 'P')) as cupo_asignado,
                -- Counts per status
                (select count(*) from solicitudes_carga where cod_empresa = $1 and estado = 'C') as count_confirmado,
                (select count(*) from solicitudes_carga where cod_empresa = $1 and estado = 'P') as count_pendiente,
                (select count(*) from solicitudes_carga where cod_empresa = $1 and estado = 'R') as count_rechazado,
                (select count(*) from solicitudes_carga where cod_empresa = $1 and estado = 'B') as count_borrador
            FROM empresas e
            where e.cod_empresa = $1
        `;

        const result = await executeQueryWithSession(user, sqlQuery, [cod_empresa]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: result.message || 'Error al obtener estadísticas del dashboard'
            });
        }

        const statsRow = result.data?.[0] || {
            total_beneficiarios: 0,
            total_solicitudes: 0,
            monto_total_confirmado: 0,
            limite_credito: 0,
            cupo_asignado: 0
        };

        return res.status(200).json({
            success: true,
            data: statsRow,
            timestamp: new Date().toISOString(),
            cod_empresa_query: cod_empresa
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error en dashboard stats:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al obtener estadísticas'
        });
    }
};
