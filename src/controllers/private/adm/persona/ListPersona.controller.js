const { executeQueryWithSession } = require('../../../../config/database');

const main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_empresa } = user;

    const query = `
      SELECT 
        p.cod_persona,
        p.usuario_pg,
        p.descripcion,
        e.nombre as empresa_nombre,
        p.cod_empresa,
        p.estado,
        p.fecha_alta,
        p.fecha_mod,
        p.nro_documento,
        p.nro_telef,
        p.correo,
        p.password_temporal as es_password_temporal,
        CASE 
          WHEN p.usuario_pg IS NOT NULL THEN
            (SELECT r.rolname
             FROM pg_user u
             JOIN pg_auth_members m ON u.usesysid = m.member
             JOIN pg_roles r ON m.roleid = r.oid
             WHERE u.usename = p.usuario_pg
               AND r.rolname LIKE 'rol_%'
             LIMIT 1)
          ELSE NULL
        END as rol_principal
      FROM personas p
      INNER JOIN empresas e ON p.cod_empresa = e.cod_empresa
      WHERE p.cod_empresa = $1
      ORDER BY p.descripcion ASC
    `;

    const result = await executeQueryWithSession(user, query, [cod_empresa]);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener personas',
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error listando personas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar personas',
      error: error.message
    });
  }
};

module.exports = { main };