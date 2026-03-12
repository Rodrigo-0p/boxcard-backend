const { executeQueryWithSession } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
require('dotenv').config();

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_persona, ...personaData } = req.body;
    const cod_empresa = user.cod_empresa;

    if (!cod_persona) {
      return res.status(400).json({ success: false, message: 'Código de persona requerido' });
    }

    const updateQuery = `
      UPDATE personas SET   descripcion   = $1
                          , nro_documento = $2
                          , nro_telef     = $3
                          , correo        = $4
                          , fecha_mod     = NOW()
                          , usuario_mod   = $5
      WHERE cod_persona = $6 AND cod_empresa = $7
    `;

    const params = [
      personaData.descripcion,
      personaData.nro_documento,
      personaData.nro_telef,
      personaData.correo,
      user.username,
      parseInt(cod_persona),
      parseInt(cod_empresa)
    ];

    const result = await executeQueryWithSession(user, updateQuery, params);

    if (!result.success) {
      throw new Error('Error al actualizar registro de persona');
    }

    return res.status(200).json({
      success: true,
      message: 'Persona actualizada exitosamente',
      data: { cod_persona }
    });

  } catch (error) {
    log_error.error('Error actualizando persona:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar persona', error: error.message });
  }
};