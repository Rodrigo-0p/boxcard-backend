const { executeQueryWithSession } = require('../../../config/database');
const { log_error, log_info } = require('../../../log/logger');

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const { descripcion } = req.body;

        if (!descripcion) {
            return res.status(400).json({
                success: false,
                message: 'La descripción (nombre) es requerida'
            });
        }

        const updateQuery = `
      UPDATE personas 
         SET descripcion = $1,
             fecha_mod = NOW()
       WHERE cod_persona = $2
         AND usuario_pg = $3
    `;

        const result = await executeQueryWithSession(user, updateQuery, [descripcion, user.cod_persona, user.username]);

        if (!result.success || result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se pudo actualizar el perfil. Usuario no encontrado.'
            });
        }

        log_info.info(`Perfil actualizado (nombre) para el usuario: ${user.username}`);

        return res.status(200).json({
            success: true,
            message: 'Perfil actualizado exitosamente',
            data: { descripcion }
        });

    } catch (error) {
        log_error.error('Error en UpdateProfile.controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al actualizar el perfil'
        });
    }
};
