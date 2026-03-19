const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

// Enviar solicitud de BORRADOR a PENDIENTE (para aprobación)
exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_solicitud } = req.body;

        if (!cod_solicitud) {
            return res.status(400).json({ success: false, mensaje: 'Falta el código de solicitud' });
        }

        const checkQ = `SELECT estado FROM solicitudes_carga WHERE cod_solicitud = $1 AND cod_empresa = $2`;
        const checkR = await executeQueryWithSession(user, checkQ, [cod_solicitud, user.cod_empresa]);

        if (!checkR.success || checkR.data.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Solicitud no encontrada' });
        }
        if (checkR.data[0].estado !== 'B') {
            return res.status(400).json({ success: false, mensaje: 'Solo se pueden enviar a aprobación solicitudes en estado Borrador' });
        }

        await executeQueryWithSession(user, `
            UPDATE solicitudes_carga
               SET estado = 'P',
                   usuario_modificacion = $1,
                   fecha_modificacion = NOW()
             WHERE cod_solicitud = $2
        `, [user.username, cod_solicitud]);

        // Obtener tipo de empresa para el mensaje
        const empQuery = `SELECT tip_empresa FROM empresas WHERE cod_empresa = $1`;
        const empResult = await executeQueryWithSession(user, empQuery, [user.cod_empresa]);
        const tip_empresa = empResult.data[0]?.tip_empresa;

        const mensaje = tip_empresa === 'NOMINA'
            ? 'Solicitud enviada correctamente a la bandeja del supervisor'
            : 'Solicitud enviada correctamente para confirmación de pago';

        return res.status(200).json({ success: true, mensaje });

    } catch (error) {
        log_error.error('Error enviando solicitud a aprobación:', error);
        return res.status(500).json({ success: false, mensaje: 'Error al enviar la solicitud a aprobación' });
    }
};
