const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;

        const sqlQuery = `
      SELECT nb.cod_beneficiario
           , nb.nro_documento
           , nb.ruc
           , nb.nombre_completo
           , nb.correo
           , nb.nro_telef
           , nb.estado
           , nb.monto_limite
           , nb.fecha_alta
           , nb.usuario_alta
           , nb.usuario_mod
        FROM nominas_benef nb
       WHERE nb.cod_empresa = $1
      AND nb.estado != 'E'
       ORDER BY nb.nombre_completo ASC
    `;

        const result = await executeQueryWithSession(user, sqlQuery, [user.cod_empresa]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: result.message || 'Error al listar beneficiarios'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error listando beneficiarios:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al listar beneficiarios'
        });
    }
};
