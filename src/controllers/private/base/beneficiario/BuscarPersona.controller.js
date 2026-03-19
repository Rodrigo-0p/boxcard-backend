const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
const moment = require('moment');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { nro_documento } = req.query;

        if (!nro_documento) {
            return res.status(400).json({
                success: false,
                mensaje: 'Número de documento requerido'
            });
        }

        // Buscar en catastro de personas
        const sqlQuery = `
      SELECT p.cod_persona
           , p.descripcion
           , p.nro_documento
           , p.correo
           , p.nro_telef
        FROM personas p
       WHERE p.nro_documento = $1
         AND p.estado = 'A'
       LIMIT 1
    `;

        const result = await executeQueryWithSession(user, sqlQuery, [nro_documento]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                mensaje: 'Error al buscar persona'
            });
        }

        if (result.data.length === 0) {
            return res.status(200).json({
                success: false,
                data: null,
                mensaje: 'Persona no encontrada en catastro'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data[0]
        });

    } catch (error) {
        log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ' Error buscando persona:', error);
        return res.status(500).json({
            success: false,
            mensaje: 'Error del servidor al buscar persona'
        });
    }
};
