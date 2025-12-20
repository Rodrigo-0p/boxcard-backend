const { executeQueryWithSession } = require('../../../../../config/database');

const main = async (req, res) => {
  try {
    const user = req.user;
    
    let query = `
      SELECT p.rolname AS value
           , r.descripcion AS label
           , CASE
                WHEN p.rolname = 'rol_super_adm' THEN 'Acceso total al sistema'
                WHEN p.rolname = 'rol_adm'       THEN 'Administración general'
                WHEN p.rolname = 'rol_cliente'   THEN 'Administrador de cliente'
                WHEN p.rolname = 'rol_usuario'   THEN 'Administrador de usuarios'
                WHEN p.rolname = 'rol_consulta'  THEN 'Consultas y reportes'
              ELSE 'Sin descripción'
             END AS descripcion
        FROM pg_roles p
        LEFT JOIN roles r
          ON p.rolname = r.cod_role
       WHERE p.rolname LIKE 'rol_%'
       ORDER BY p.rolname;
    `;
    
    const result = await executeQueryWithSession(user, query, []);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener roles',
        data: []
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error listando roles:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar roles',
      error: error.message
    });
  }
};

module.exports = { main };