const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');

// Rechazar una solicitud PENDIENTE
exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_solicitud, motivo_rechazo } = req.body;

        if (!cod_solicitud) {
            return res.status(400).json({ success: false, mensaje: 'Falta el código de solicitud' });
        }

        const checkQ = `SELECT cod_empresa_destino, estado FROM solicitudes_carga WHERE cod_solicitud = $1`;
        const checkR = await executeQueryWithSession(user, checkQ, [cod_solicitud]);

        if (!checkR.success || checkR.data.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Solicitud no encontrada' });
        }

        const solicitud = checkR.data[0];

        if (user.role !== 'rol_super_adm' && solicitud.cod_empresa_destino !== user.cod_empresa) {
            return res.status(403).json({ success: false, mensaje: 'No tiene permisos para rechazar esta solicitud' });
        }

        if (solicitud.estado !== 'P') {
            return res.status(400).json({ success: false, mensaje: 'Solo se pueden rechazar solicitudes en estado Pendiente' });
        }

        await executeQueryWithSession(user, `
            UPDATE solicitudes_carga
               SET estado = 'R',
                   motivo_rechazo = $1,
                   usuario_confirmacion = $2,
                   fecha_confirmacion = NOW()
             WHERE cod_solicitud = $3
        `, [motivo_rechazo || 'RECHAZADA POR ADMINISTRADOR', user.username, cod_solicitud]);

        return res.status(200).json({ success: true, mensaje: 'Solicitud rechazada correctamente' });

    } catch (error) {
        log_error.error('Error rechazando solicitud:', error);
        return res.status(500).json({ success: false, mensaje: 'Error al rechazar la solicitud' });
    }
};
