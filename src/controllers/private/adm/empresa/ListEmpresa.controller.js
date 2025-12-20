const { executeQueryWithSession } = require('../../../../config/database');

const main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_persona , role } = user;
    let query, params;

     if (role === 'rol_super_adm') {
        query = `
           SELECT e.cod_empresa
                , e.nombre
                , e.ruc
                , e.direccion
                , e.correo
                , e.nro_telef
                , e.tip_empresa
                , e.modalidad
                , e.estado
                , e.fecha_alta
                , e.fecha_mod
                , e.logo_url
                , e.limit_venc
             FROM empresas e
            ORDER BY nombre ASC
        `;
         params = [];
     }else{
      query = `
           SELECT e.cod_empresa
                , e.nombre
                , e.ruc
                , e.direccion
                , e.correo
                , e.nro_telef
                , e.tip_empresa
                , e.modalidad
                , e.estado
                , e.fecha_alta
                , e.fecha_mod
                , e.logo_url
                , e.limit_venc
            FROM empresas e
            INNER JOIN personas p ON e.cod_empresa = p.cod_empresa
            WHERE p.cod_persona = $1
              AND e.estado = 'A'
              AND p.estado = 'A'
            ORDER BY e.nombre ASC
        `;
        params = [cod_persona];
     }
     
    const result = await executeQueryWithSession(user, query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        mensaje: 'Error al obtener empresas',
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error listando empresas:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al listar empresas',
      error: error.message
    });
  }
};

module.exports = { main };