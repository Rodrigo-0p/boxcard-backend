const { executeQueryWithSession } = require('../../../../../config/database');

const main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_empresa , role } = user;
    let query, params;
    
     if (role === 'rol_super_adm') {
        query = `
           SELECT e.cod_empresa
                , e.nombre
             FROM empresas e
            WHERE e.estado = 'A'
            ORDER BY e.nombre ASC
        `;
         params = [];
     }else{
      query = `
           SELECT e.cod_empresa
                , e.nombre
            FROM empresas e
            WHERE e.cod_empresa = $1 
            ORDER BY e.nombre ASC
        `;
        params = [cod_empresa];
     }
     
    const result = await executeQueryWithSession(user, query, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener empresas',
        data: []
      });
    }

    return res.status(200).json({
      success    : true,
      data       : result.data,
      can_select : role === 'rol_super_adm' || false  // Indica si puede seleccionar otra empresa
    });

  } catch (error) {
    console.error('Error listando getListEmpresa:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar getListEmpresa',
      error: error.message
    });
  }
};

module.exports = { main };