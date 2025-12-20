const { log_error } = require('../../../log/logger')
const { executeQueryWithSession } = require('../../../config/database');

exports.main = async (req, res) => {
  try {
    const { user } = req;
    
    // Query con cod_empresa
    const query = `
      SELECT DISTINCT 
        m.cod_menu, 
        m.nombre_menu, 
        m.icono, 
        m.ruta, 
        m.orden, 
        m.cod_menu_padre
      FROM menus m
      INNER JOIN roles_menu_espec rme ON rme.cod_menu = m.cod_menu
      WHERE rme.cod_empresa = $1
        AND rme.usuario_pg  = $2
        AND rme.estado      = 'A'
        AND m.estado        = 'A'
      ORDER BY m.cod_menu_padre NULLS FIRST, m.orden ASC
    `;

    const result = await executeQueryWithSession(user, query, [user.cod_empresa, user.username]);

    if (!result.success) {
      log_error.error('Error obteniendo menús del usuario');
      return res.status(500).json({
        success: false,
        message: 'Error obteniendo menús del usuario'
      });
    }
    
    const menuTree = buildMenuTree(result.data);
    
    return res.status(200).json({
      success: true,
      data: menuTree
    });
    
  } catch (error) {
    log_error.error('Error en getUserMenus:', error);
    console.error('Error en getUserMenus:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

const buildMenuTree = (menuItems) => {
  const menuMap = new Map();
  const rootMenus = [];

  menuItems.forEach(item => {
    menuMap.set(item.cod_menu, {
      key      : item.cod_menu.toString(),
      label    : item.nombre_menu,
      icon     : item.icono,
      path     : item.ruta,
      children : []
    });
  });

  menuItems.forEach(item => {
    const menuItem = menuMap.get(item.cod_menu);

    if (item.cod_menu_padre) {
      const parent = menuMap.get(item.cod_menu_padre);
      if (parent) {
        parent.children.push(menuItem);
      }
    } else {
      rootMenus.push(menuItem);
    }
  });

  return rootMenus;
};