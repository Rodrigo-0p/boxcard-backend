const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_solicitud, nro_comprobante, url_comprobante } = req.body;

        if (!nro_comprobante) {
            return res.status(400).json({ success: false, mensaje: 'El número de comprobante es obligatorio para confirmar la carga.' });
        }

        // 1. Obtener datos de la solicitud y validar que el usuario tenga permiso
        // El usuario puede aprobar si es el super adm, o si es la empresa destino
        const sQuery = `
            SELECT cod_empresa, cod_empresa_destino, monto_solicitado, estado 
              FROM solicitudes_carga 
             WHERE cod_solicitud = $1
        `;
        const sResult = await executeQueryWithSession(user, sQuery, [cod_solicitud]);

        if (!sResult.success || sResult.data.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Solicitud no encontrada' });
        }

        const solicitud = sResult.data[0];

        // Verificamos permisos: debe ser la empresa destino o super adm
        if (user.role !== 'rol_super_adm' && solicitud.cod_empresa_destino !== user.cod_empresa) {
            return res.status(403).json({ success: false, mensaje: 'No tiene permisos para confirmar esta solicitud' });
        }

        if (solicitud.estado === 'C') {
            return res.status(400).json({ success: false, mensaje: 'La solicitud ya fue confirmada' });
        }

        const cod_empresa_cliente = solicitud.cod_empresa;

        // 2. Actualizar estado de solicitud y auditoría
        await executeQueryWithSession(user, `
            UPDATE solicitudes_carga 
               SET estado = 'C',
                   nro_comprobante = $1,
                   url_comprobante = $2,
                   usuario_confirmacion = $3,
                   fecha_confirmacion = NOW()
             WHERE cod_solicitud = $4
        `, [nro_comprobante, url_comprobante || null, user.username, cod_solicitud]);

        return res.status(200).json({
            success: true,
            mensaje: 'Recargas procesadas y solicitud confirmada exitosamente'
        });

    } catch (error) {
        log_error.error('Error aprobando solicitud:', error);
        return res.status(500).json({ success: false, mensaje: 'Error al procesar la aprobación' });
    }
};
