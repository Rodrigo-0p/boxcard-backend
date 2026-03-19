const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const moveComprobanteToFinal = (tempPath, cod_solicitud) => {
    const ext = path.extname(tempPath);
    const destDir = path.join(process.cwd(), 'src', 'filestore', 'comprobantes', String(cod_solicitud));

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const finalPath = path.join(destDir, `comprobante_${cod_solicitud}${ext}`);

    if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
    }

    fs.renameSync(tempPath, finalPath);

    return `/comprobantes/${cod_solicitud}/comprobante_${cod_solicitud}${ext}`;
};

exports.main = async (req, res) => {
    try {
        const user = req.user;
        log_info.info(`Aprobando solicitud - Body: ${JSON.stringify(req.body)} - File: ${req.file ? req.file.originalname : 'No file'}`);
        const { cod_solicitud, nro_comprobante } = req.body;
        let url_comprobante = req.body.url_comprobante || null;

        if (req.file) {
            url_comprobante = moveComprobanteToFinal(req.file.path, cod_solicitud);
        }

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
            log_error.error(`[APPROVE_SOL] Solicitud no encontrada: ${cod_solicitud} - User: ${user.username}`);
            return res.status(404).json({ success: false, mensaje: 'Solicitud no encontrada' });
        }

        const solicitud = sResult.data[0];

        // Verificamos permisos: debe ser la empresa destino o super adm
        if (user.role !== 'rol_super_adm' && solicitud.cod_empresa_destino !== user.cod_empresa) {
            log_error.error(`[APPROVE_SOL] Permiso denegado - User: ${user.username} - Role: ${user.role} - Solicitud: ${cod_solicitud}`);
            return res.status(403).json({ success: false, mensaje: 'No tiene permisos para confirmar esta solicitud' });
        }

        if (solicitud.estado === 'C') {
            log_error.error(`[APPROVE_SOL] Solicitud ya confirmada - User: ${user.username} - Solicitud: ${cod_solicitud}`);
            return res.status(400).json({ success: false, mensaje: 'La solicitud ya fue confirmada' });
        }

        const cod_empresa_cliente = solicitud.cod_empresa;

        // 2. Actualizar estado de solicitud y auditoría
        const updateResult = await executeQueryWithSession(user, `
            UPDATE solicitudes_carga 
               SET estado = 'C',
                   nro_comprobante = $1,
                   url_comprobante = $2,
                   usuario_confirmacion = $3,
                   fecha_confirmacion = NOW()
             WHERE cod_solicitud = $4
        `, [nro_comprobante, url_comprobante || null, user.username, cod_solicitud]);

        if (!updateResult.success) {
            log_error.error(`[APPROVE_SOL] Error al actualizar BD - User: ${user.username} - Solicitud: ${cod_solicitud} - Error: ${updateResult.message}`);
            throw new Error(updateResult.message || 'Error al actualizar base de datos');
        }

        log_info.info(`[APPROVE_SOL] Solicitud ${cod_solicitud} aprobada exitosamente por ${user.username}`);

        return res.status(200).json({
            success: true,
            mensaje: 'Recargas procesadas y solicitud confirmada exitosamente'
        });

    } catch (error) {
        // Limpiar archivo temporal si existe y falló el proceso
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        log_error.error(`[APPROVE_SOL_CRITICAL] Error: ${error.message} - User: ${req.user?.username} - Body: ${JSON.stringify(req.body)}`, error);
        return res.status(500).json({ success: false, mensaje: 'Error al procesar la aprobación', error: error.message });
    }
};
