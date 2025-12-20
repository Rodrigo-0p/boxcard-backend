const { executeQueryWithSession } = require('../../../../../config/database');
const { log_error }               = require('../../../../../log/logger');

const main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_persona } = req.query;

    if (!cod_persona) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro cod_persona es requerido'
      });
    }

    // Obtener usuario_pg y cod_empresa de la persona
    const personaQuery = `
      SELECT usuario_pg
           , cod_empresa 
        FROM personas 
      WHERE cod_persona = $1
    `;
    const personaResult = await executeQueryWithSession(user, personaQuery, [cod_persona]);
    
    if (!personaResult.success || personaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Persona no encontrada'
      });
    }

    const { usuario_pg, cod_empresa } = personaResult.data[0];

    // Si no tiene usuario, retornar vacío
    if (!usuario_pg) {
      return res.status(200).json({
        success: true,
        data: {}
      });
    }

    // Obtener menús activos agrupados por rol
    const menusQuery = `
     SELECT cod_role
          , json_agg(cod_menu ORDER BY cod_menu) as menus
       FROM roles_menu_espec
      WHERE cod_empresa = $1
        AND usuario_pg  = $2
        AND estado      = 'A'
      GROUP BY cod_role
      ORDER BY cod_role
    `;

    const result = await executeQueryWithSession(user, menusQuery, [cod_empresa, usuario_pg]);

    if (!result.success) {
      log_error.error('Error obteniendo menús de la persona');
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo menús de la persona'
      });
    }

    // Convertir array a objeto { rol: [menus] }
    const menusActivos = {};
    result.data.forEach(row => {
      menusActivos[row.cod_role] = row.menus;
    });

    return res.status(200).json({
      success: true,
      data: menusActivos
    });

  } catch (error) {
    log_error.error('Error en getMenusPersona:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

module.exports = { main };