const { executeQueryWithSession } = require('../../../../config/database');
const path          = require('path');
const fs            = require('fs');
const { log_error } = require('../../../../log/logger')

const moveLogoToFinal = (tempPath, cod_empresa) => {
  const ext = path.extname(tempPath);
  const empresaDir = path.join(process.cwd(), 'src', 'filestore', 'empresas', String(cod_empresa));
  
  if (!fs.existsSync(empresaDir)) {
    fs.mkdirSync(empresaDir, { recursive: true });
  }
  
  const finalPath = path.join(empresaDir, `${cod_empresa}${ext}`);
  
  if (fs.existsSync(finalPath)) {
    fs.unlinkSync(finalPath);
  }
  
  fs.renameSync(tempPath, finalPath);
  
  return `/empresas/${cod_empresa}/${cod_empresa}${ext}`;
};

exports.main = async (req, res) => {
  let tempFilePath = null;
  
  try {
    const user = req.user;
    const empresaData = req.body;
    
    if (req.file) {
      tempFilePath = req.file.path;
    }

    // OBTENER PRÓXIMO CÓDIGO MANUALMENTE
    const maxResult = await executeQueryWithSession(
      user,
      'SELECT COALESCE(MAX(cod_empresa), 0) + 1 as next_code FROM empresas',
      []
    );    
    
    const next_cod = maxResult.data[0].next_code;

    // INSERT empresa sin logo primero
    const query = `
      INSERT INTO empresas (  cod_empresa
                            , nombre
                            , ruc
                            , direccion
                            , correo
                            , nro_telef
                            , tip_empresa
                            , modalidad
                            , limit_venc
                            , estado
                            , fecha_alta
                            ) 
                              VALUES 
                            ( 
                              $1
                            , $2
                            , $3
                            , $4
                            , $5
                            , $6
                            , $7
                            , $8
                            , $9 
                            , $10 
                            , now() ) RETURNING cod_empresa`;    
    const params = [
      next_cod
    , empresaData.nombre
    , empresaData.ruc
    , empresaData.direccion
    , empresaData.correo
    , empresaData.nro_telef
    , empresaData.tip_empresa
    , empresaData.modalidad
    , empresaData.limite_venc || 0
    , empresaData.estado      || 'A'
    ];
    
    const result = await executeQueryWithSession(user, query, params);
    
    if (!result.success || !result.data[0]) {
      throw new Error('Error al crear empresa');
    }
    
    const cod_empresa = result.data[0].cod_empresa;
    
    // Si hay logo, moverlo y actualizar BD
    if (tempFilePath) {
      const logo_url = moveLogoToFinal(tempFilePath, cod_empresa);
      tempFilePath = null;
      
      await executeQueryWithSession(
        user,
        'UPDATE empresas SET logo_url = $1 WHERE cod_empresa = $2',
        [logo_url, cod_empresa]
      );
    }

    return res.status(200).json({
      success : true,
      mensaje : 'Empresa creada exitosamente',
      data    : { cod_empresa }
    });

  } catch (error) {
    // Limpiar archivo temporal si existe
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    log_error.error('Error creando empresa:', error);
    console.error('Error creando empresa:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al crear empresa',
      error: error.message
    });
  }
};