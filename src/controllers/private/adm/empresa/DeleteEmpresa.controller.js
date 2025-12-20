const { executeQueryWithSession } = require('../../../../config/database');
const path = require('path');
const fs  = require('fs');

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const { cod_empresa } = req.body;

    if (!cod_empresa) {
      return res.status(400).json({
        success: false,
        mensaje: 'Código de empresa requerido'
      });
    }

    // OBTENER LOGO_URL ANTES DE ELIMINAR
    const logoQuery  = 'SELECT logo_url FROM empresas WHERE cod_empresa = $1';
    const logoResult = await executeQueryWithSession(user, logoQuery, [cod_empresa]);

    // ELIMINAR EMPRESA DE BD
    const deleteQuery = 'DELETE FROM empresas WHERE cod_empresa = $1';
    const result = await executeQueryWithSession(user, deleteQuery, [cod_empresa]);

    if (!result.success) {
      throw new Error('Error al eliminar empresa');
    }

    // ELIMINAR CARPETA FÍSICA CON LOGO
    if (logoResult.success && logoResult.data[0]?.logo_url) {
      const empresaDir = path.join(
        process.cwd(),'src','filestore','empresas', String(cod_empresa));
      
      if (fs.existsSync(empresaDir)) {
        fs.rmSync(empresaDir, { recursive: true, force: true });
      }
    }

    return res.status(200).json({
      success: true,
      mensaje: 'Empresa eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando empresa:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al eliminar empresa',
      error: error.message
    });
  }
};