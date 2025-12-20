const { executeQueryWithSession } = require('../../../config/database');

exports.main = async (req, res) => {
  try {
    const { tablas } = req.body;
    const user = req.user; // { username, password, empresa_login, etc }
    
    // Validar entrada
    if (!tablas || !Array.isArray(tablas) || tablas.length === 0) {
      return res.status(400).json({
        success: false,
        mensaje: 'Debe proporcionar al menos una tabla'
      });
    }

    const permisos = {};
    
    // Verificar permisos para cada tabla usando la sesión del usuario
    for (const tabla of tablas) {
      const query = `
        SELECT 
          has_table_privilege(CURRENT_USER, $1, 'SELECT') as view,
          has_table_privilege(CURRENT_USER, $1, 'INSERT') as insert,
          has_table_privilege(CURRENT_USER, $1, 'UPDATE') as update,
          has_table_privilege(CURRENT_USER, $1, 'DELETE') as delete
      `;
      
      const result = await executeQueryWithSession(user, query, [tabla]);
      
      if (result.success && result.data.length > 0) {
        permisos[tabla] = {
          view   : result.data[0].view    
        , insert : result.data[0].insert  
        , update : result.data[0].update  
        , delete : result.data[0].delete
        };
      } else {
        // Si falla, asignar sin permisos
        permisos[tabla] = {
          view   : false,
          insert : false,
          update : false,
          delete : false
        };
      }
    }

    // Calcular permisos globales del formulario
    const permisosGlobales = {
      view         : Object.values(permisos).some(p => p.view),
      insert       : Object.values(permisos).some(p => p.insert),
      update       : Object.values(permisos).some(p => p.update),
      delete       : Object.values(permisos).some(p => p.delete),
      tieneAcceso  : Object.values(permisos).some(p => p.view)
    };

    return res.status(200).json({
      success: true,
      permisos: {
        porTabla: permisos,
        globales: permisosGlobales
      }
    });

  } catch (error) {
    console.error('Error verificando permisos:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al verificar permisos',
      error: error.message
    });
  }
};