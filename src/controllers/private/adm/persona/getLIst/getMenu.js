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

    // 1. Obtener si la empresa es proveedora
    const empresaQuery = `SELECT es_proveedor FROM empresas WHERE cod_empresa = $1`;
    const empresaResult = await executeQueryWithSession(user, empresaQuery, [user.cod_empresa]);

    let es_proveedor = 'N';
    if (empresaResult.success && empresaResult.data.length > 0) {
      es_proveedor = empresaResult.data[0].es_proveedor;
    }

    // 2. Filtro para ocultar el menú 13 a las empresas que NO son proveedoras
    let filterProveedor = '';
    if (es_proveedor !== 'S') {
      filterProveedor = `AND m.cod_menu != 13`;
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
          ${filterProveedor}
        
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
          ${filterProveedor}
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