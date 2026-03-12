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

    // INACTIVAR EMPRESA EN BD (Soft Delete - Estado 'E' para eliminado)
    const deleteQuery = "UPDATE empresas SET estado = 'E', fecha_mod = NOW(), usuario_mod = $1 WHERE cod_empresa = $2";
    const result = await executeQueryWithSession(user, deleteQuery, [user.username, parseInt(cod_empresa)]);

    if (!result.success) {
      throw new Error('Error al eliminar empresa');
    }

    // Ya no eliminamos la carpeta física con el logo para mantener integridad de datos
    
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