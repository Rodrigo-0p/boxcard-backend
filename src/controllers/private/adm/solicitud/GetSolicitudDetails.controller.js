const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { cod_solicitud } = req.params;

        if (!cod_solicitud) {
            return res.status(400).json({ success: false, mensaje: 'Falta el código de solicitud' });
        }

        const sqlQuery = `
            SELECT sd.cod_beneficiario
                 , b.nombre_completo as nombre
                 , b.nro_documento
                 , sd.monto
                 , b.monto_limite
              FROM solicitudes_carga_det sd
              JOIN nominas_benef b ON sd.cod_beneficiario = b.cod_beneficiario
             WHERE sd.cod_solicitud = $1
        `;

        const result = await executeQueryWithSession(user, sqlQuery, [cod_solicitud]);

        if (!result.success) {
            return res.status(500).json({ success: false, mensaje: 'Error al obtener detalles' });
        }

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        log_error.error('Error al obtener detalles de solicitud:', error);
        return res.status(500).json({ success: false, mensaje: 'Error al procesar la solicitud' });
    }
};
