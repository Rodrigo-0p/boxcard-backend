const { executeQueryWithSession } = require('../../../../../config/database');
const { log_error } = require('../../../../../log/logger');

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const { rol } = req.query;

    if (!rol) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro rol es requerido'
      });
    }

    // Query recursiva para obtener menús del rol desde roles_menus
    const query = `
      WITH RECURSIVE menu_hierarchy AS (
        -- Menús raíz del rol
        SELECT 
          m.cod_menu, 
          m.nombre_menu AS nombre, 
          m.ruta AS url, 
          m.icono, 
          m.cod_menu_padre, 
          m.orden
        FROM menus m
        INNER JOIN roles_menus rm ON m.cod_menu = rm.cod_menu
        WHERE rm.cod_role = $1 
          AND m.estado    = 'A' 
          AND rm.estado   = 'A'
          AND m.cod_menu_padre IS NULL
        
        UNION ALL
        
        -- Menús hijos recursivamente
        SELECT 
          m.cod_menu, 
          m.nombre_menu AS nombre, 
          m.ruta AS url,
          m.icono, 
          m.cod_menu_padre, 
          m.orden
        FROM menus m
        INNER JOIN menu_hierarchy mh ON m.cod_menu_padre = mh.cod_menu
        INNER JOIN roles_menus rm ON m.cod_menu = rm.cod_menu
        WHERE m.estado    = 'A'
          AND rm.cod_role = $1
          AND rm.estado   = 'A'
      )
      SELECT DISTINCT * 
        FROM menu_hierarchy
       ORDER BY cod_menu_padre NULLS FIRST, orden, nombre
    `;

    const result = await executeQueryWithSession(user, query, [rol]);

    if (!result.success) {
      log_error.error('Error obteniendo menús del rol');
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo menús del rol'
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    log_error.error('Error en getMenus:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};