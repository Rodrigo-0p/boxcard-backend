const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_solicitud, motivo_anulacion } = req.body;

        if (!cod_solicitud) {
            return res.status(400).json({ success: false, mensaje: 'Falta el código de solicitud' });
        }

        const checkQ = `SELECT estado, nro_solicitud, observaciones FROM solicitudes_carga WHERE cod_solicitud = $1 AND cod_empresa = $2`;
        const checkR = await executeQueryWithSession(user, checkQ, [cod_solicitud, user.cod_empresa]);

        if (!checkR.success || checkR.data.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Solicitud no encontrada' });
        }

        const solicitud = checkR.data[0];

        if (solicitud.estado === 'C' || solicitud.estado === 'R' || solicitud.estado === 'A') {
            return res.status(400).json({ success: false, mensaje: `No se puede anular/eliminar una solicitud en estado ${solicitud.estado}` });
        }

        // Si es Borrador (B), eliminamos físicamente (limpieza de base de datos)
        if (solicitud.estado === 'B') {
            await executeQueryWithSession(user, `DELETE FROM solicitudes_carga_det WHERE cod_solicitud = $1`, [cod_solicitud]);
            await executeQueryWithSession(user, `DELETE FROM solicitudes_carga WHERE cod_solicitud = $1`, [cod_solicitud]);
            return res.status(200).json({ success: true, mensaje: 'Solicitud eliminada correctamente' });
        }

        // Si es PENDIENTE (o cualquier otro estado no bloqueado), ANULAMOS (soft delete / auditoría)
        const motivoText = motivo_anulacion ? ` | MOTIVO: ${motivo_anulacion}` : '';
        const nuevasObs = `SOLICITUD ANULADA POR USUARIO ${user.username}${motivoText}. Original: ${solicitud.observaciones || ''}`;

        await executeQueryWithSession(user, `
            UPDATE solicitudes_carga 
               SET estado = 'A',
                   observaciones = $1,
                   fecha_confirmacion = NOW(), -- Usamos este campo para marcar cuando se anuló
                   usuario_confirmacion = $2
             WHERE cod_solicitud = $3
        `, [nuevasObs.substring(0, 500), user.username, cod_solicitud]);

        return res.status(200).json({ success: true, mensaje: 'Solicitud anulada correctamente' });

    } catch (error) {
        log_error.error('Error eliminando/anulando solicitud:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error al procesar la solicitud',
            error: error.message
        });
    }
};
