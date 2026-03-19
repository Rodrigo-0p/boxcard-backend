const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

const main = async (req, res) => {
    try {
        const user = req.user;

        // Obtenemos el límite y el cupo consumido de la empresa del usuario
        const query = `
       SELECT e.cod_empresa
            , e.nombre
            , COALESCE(e.limite_credito, 0) as limite_credito
            , (SELECT COALESCE(SUM(monto_solicitado), 0) FROM solicitudes_carga WHERE cod_empresa = e.cod_empresa AND estado IN ('C', 'P')) as cupo_asignado
         FROM empresas e
        WHERE e.cod_empresa = $1
    `;

        const result = await executeQueryWithSession(user, query, [user.cod_empresa]);

        if (!result.success || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Empresa no encontrada'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.data[0]
        });

    } catch (error) {
        log_error.error('Error obteniendo status financiero de empresa:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

module.exports = { main };
