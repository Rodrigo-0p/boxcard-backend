const { executeQueryWithSession } = require('../../../../config/database');
const { log_error, log_info } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const {
            cod_beneficiario,
            nombre_completo,
            ruc,
            correo,
            nro_telef,
            estado,
            monto_limite,
        } = req.body;

        if (!cod_beneficiario) {
            return res.status(400).json({
                success: false,
                mensaje: 'Código de beneficiario requerido'
            });
        }

        // Si se intenta activar, verificar regla de una sola empresa activa
        if (estado === 'A') {
            const currentDoc = await executeQueryWithSession(user, 'SELECT nro_documento FROM nominas_benef WHERE cod_beneficiario = $1', [cod_beneficiario]);
            if (currentDoc.success && currentDoc.data.length > 0) {
                const doc = currentDoc.data[0].nro_documento;
                const checkActiveQuery = `
                    SELECT b.cod_beneficiario, e.nombre as empresa_nombre
                      FROM nominas_benef b
                      JOIN empresas e ON b.cod_empresa = e.cod_empresa
                     WHERE b.nro_documento = $1
                       AND b.estado = 'A'
                       AND b.cod_empresa != $2
                `;
                const activeResult = await executeQueryWithSession(user, checkActiveQuery, [doc, user.cod_empresa]);

                if (activeResult.success && activeResult.data.length > 0) {
                    return res.status(400).json({
                        success: false,
                        mensaje: `No se puede activar. Esta persona ya está activa en: ${activeResult.data[0].empresa_nombre}.`
                    });
                }
            }
        }

        const updateQuery = `
      UPDATE nominas_benef
         SET nombre_completo = COALESCE($1, nombre_completo)
           , ruc             = COALESCE($2, ruc)
           , correo          = COALESCE($3, correo)
           , nro_telef       = COALESCE($4, nro_telef)
           , estado          = COALESCE($5, estado)
           , monto_limite    = COALESCE($6, monto_limite)
       WHERE cod_beneficiario = $7
         AND cod_empresa      = $8
    `;

        const params = [
            nombre_completo || null,
            ruc || null,
            correo || null,
            nro_telef || null,
            estado || null,
            monto_limite != null ? monto_limite : null,
            cod_beneficiario,
            user.cod_empresa,
        ];

        const result = await executeQueryWithSession(user, updateQuery, params);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: result.message || 'Error al actualizar beneficiario'
            });
        }

        log_info.info(`Beneficiario actualizado: ${cod_beneficiario} - Empresa: ${user.cod_empresa} - User: ${user.username}`);

        return res.status(200).json({
            success: true,
            mensaje: 'Beneficiario actualizado exitosamente'
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error actualizando beneficiario:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al actualizar beneficiario'
        });
    }
};
