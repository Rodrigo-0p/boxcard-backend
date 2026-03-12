const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
const { nvl } = require('../../../../utils/main');
require('dotenv').config();

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const personaData = req.body;
    const cod_empresa = user.cod_empresa;

    if (!cod_empresa) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo identificar la empresa de la sesión'
      });
    }

    const maxResult = await executeQueryWithSession(
      user,
      'SELECT COALESCE(MAX(cod_persona), 0) + 1 as next_code FROM personas',
      []
    );

    const next_cod = maxResult.data[0].next_code;

    const insertQuery = `
      INSERT INTO personas (
          cod_persona
        , descripcion
        , nro_documento
        , nro_telef
        , correo
        , cod_empresa
        , estado
        , fecha_alta
        , usuario_alta      
      ) VALUES ( 
        $1, $2, $3, $4, $5, $6, $7, NOW(), $8) 
      RETURNING cod_persona
    `;

    const params = [
      parseInt(next_cod),
      personaData.descripcion,
      personaData.nro_documento,
      personaData.nro_telef,
      personaData.correo,
      parseInt(cod_empresa),
      personaData.estado || 'A',
      user.username
    ];

    const result = await executeQueryWithSession(user, insertQuery, params);

    if (!result.success || !result.data[0]) {
      throw new Error('Error al crear persona');
    }

    const cod_persona = result.data[0].cod_persona;

    return res.status(200).json({
      success: true,
      message: 'Persona creada exitosamente',
      data: { cod_persona }
    });

  } catch (error) {
    log_error.error('Error creando persona:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear persona',
      error: error.message
    });
  }
};
