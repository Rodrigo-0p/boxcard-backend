const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_beneficiario } = req.body;

        if (!cod_beneficiario) {
            return res.status(400).json({
                success: false,
                mensaje: 'Código de beneficiario requerido'
            });
        }

        // 1. Obtener datos para la notificación y verificar estado actual
        const checkQuery = `
      SELECT nro_telef, nombre_completo, estado 
        FROM nominas_benef 
       WHERE cod_beneficiario = $1 
         AND cod_empresa = $2
    `;
        const checkResult = await executeQueryWithSession(user, checkQuery, [cod_beneficiario, user.cod_empresa]);

        if (!checkResult.success || checkResult.data.length === 0) {
            return res.status(404).json({ success: false, mensaje: 'Beneficiario no encontrado' });
        }

        const benef = checkResult.data[0];
        if (benef.estado !== 'P') {
            return res.status(400).json({ success: false, mensaje: 'El beneficiario ya está procesado' });
        }

        // 2. Verificar regla de una sola empresa activa
        const checkActiveQuery = `
            SELECT b.cod_beneficiario, e.nombre as empresa_nombre
              FROM nominas_benef b
              JOIN empresas e ON b.cod_empresa = e.cod_empresa
             WHERE b.nro_documento = (SELECT nro_documento FROM nominas_benef WHERE cod_beneficiario = $1)
               AND b.estado = 'A'
               AND b.cod_empresa != $2
        `;
        const activeResult = await executeQueryWithSession(user, checkActiveQuery, [cod_beneficiario, user.cod_empresa]);

        if (activeResult.success && activeResult.data.length > 0) {
            return res.status(400).json({
                success: false,
                mensaje: `No se puede activar. Esta persona ya está activa en: ${activeResult.data[0].empresa_nombre}.`
            });
        }

        // 3. (Validación de cupo eliminada: ahora se gestiona en Solicitudes)

        // 4. Activar beneficiario
        const approveQuery = `
      UPDATE nominas_benef
         SET estado      = 'A'
           , fecha_mod   = NOW()
           , usuario_mod = $1
       WHERE cod_beneficiario = $2
         AND cod_empresa      = $3
    `;

        const result = await executeQueryWithSession(user, approveQuery, [user.username || 'SISTEMA', cod_beneficiario, user.cod_empresa]);

        if (!result.success) {
            return res.status(500).json({ success: false, mensaje: 'Error al aprobar beneficiario' });
        }

        // 3. Simulación de envío de SMS
        log_info.info(`[SMS SIMULADO] Enviado a ${benef.nro_telef}: Hola ${benef.nombre_completo}, tu tarjeta BoxCard ha sido activada.`);

        log_info.info(`Beneficiario aprobado: ${cod_beneficiario} - Empresa: ${user.cod_empresa} - User: ${user.username}`);

        return res.status(200).json({
            success: true,
            mensaje: 'Beneficiario aprobado y activado exitosamente'
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error aprobando beneficiario:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al aprobar beneficiario'
        });
    }
};
