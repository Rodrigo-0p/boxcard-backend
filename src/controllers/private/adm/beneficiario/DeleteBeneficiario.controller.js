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

        // Soft delete: cambiar estado a 'I'
        const deleteQuery = `
      UPDATE nominas_benef
         SET estado = 'I'
       WHERE cod_beneficiario = $1
         AND cod_empresa      = $2
    `;

        const result = await executeQueryWithSession(user, deleteQuery, [cod_beneficiario, user.cod_empresa]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: result.message || 'Error al eliminar beneficiario'
            });
        }

        log_info.info(`Beneficiario eliminado (soft): ${cod_beneficiario} - Empresa: ${user.cod_empresa} - User: ${user.username}`);

        return res.status(200).json({
            success: true,
            mensaje: 'Beneficiario eliminado exitosamente'
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error eliminando beneficiario:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al eliminar beneficiario'
        });
    }
};
