const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
require('dotenv').config();

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_persona } = req.body;


    if (!cod_persona) {
      return res.status(400).json({ success: false, message: 'Código de persona requerido' });
    }

    // En lugar de eliminar, cambiamos el estado a 'E' (Eliminado) - SCOPED BY COMPANY
    const softDeleteQuery = `UPDATE personas SET estado = 'E', usuario_mod = $1, fecha_mod = NOW() WHERE cod_persona = $2 AND cod_empresa = $3`;
    const result = await executeQueryWithSession(user, softDeleteQuery, [user.username, parseInt(cod_persona), parseInt(user.cod_empresa)]);

    if (!result.success) {
      throw new Error('Error al marcar persona como eliminada.');
    }

    return res.status(200).json({
      success: true,
      message: 'Persona eliminada exitosamente (Soft Delete)'
    });

  } catch (error) {
    log_error.error('Error eliminando persona:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar persona', error: error.message });
  }
};
