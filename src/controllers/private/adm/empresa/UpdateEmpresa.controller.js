const { executeQueryWithSession } = require('../../../../config/database');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { log_error } = require('../../../../log/logger');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });


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
    const { cod_empresa, ...empresaData } = req.body;

    if (!cod_empresa) {
      return res.status(400).json({
        success: false,
        mensaje: 'Código de empresa requerido'
      });
    }

    if (req.file) {
      tempFilePath = req.file.path;
    }

    let logo_url = null;

    // Si hay nuevo logo, moverlo
    if (tempFilePath) {
      logo_url = moveLogoToFinal(tempFilePath, cod_empresa);
      tempFilePath = null;
    }

    // UPDATE empresa
    const query = `
      UPDATE empresas SET
        nombre      = $1
      , ruc         = $2
      , direccion   = $3
      , correo      = $4
      , nro_telef   = $5
      , tip_empresa = $6
      , modalidad   = $7
      , estado      = $8
      , es_proveedor = $9
      , limite_credito = $10
      , fecha_mod   = NOW()
        ${logo_url ? ', logo_url = $12' : ''}
      WHERE cod_empresa = $11
    `;

    const params = [
      empresaData.nombre
      , empresaData.ruc
      , empresaData.direccion
      , empresaData.correo
      , empresaData.nro_telef
      , empresaData.tip_empresa
      , empresaData.modalidad
      , empresaData.estado || 'A'
      , empresaData.es_proveedor === true || empresaData.es_proveedor === 'S' ? 'S' : 'N'
      , empresaData.limite_credito || 0
      , cod_empresa
    ];

    if (logo_url) params.push(logo_url);

    const result = await executeQueryWithSession(user, query, params);

    if (!result.success) {
      throw new Error('Error al actualizar empresa');
    }

    let newToken = null;
    if (logo_url) {
      const tokenPayload = { ...user };

      delete tokenPayload.exp;
      delete tokenPayload.iat;
      delete tokenPayload.password;

      let bandnewToken = false;
      if (tokenPayload.empresas.length > 1) {
        bandnewToken = true;
        if (parseInt(user.cod_empresa) === parseInt(cod_empresa)) tokenPayload.logo_url = logo_url;
        tokenPayload.empresas.map((items) => {
          if (items.cod_empresa === parseInt(cod_empresa)) items.logo_url = logo_url;
        })
      } else if (parseInt(user.cod_empresa) === parseInt(cod_empresa)) {
        bandnewToken = true;
        tokenPayload.logo_url = logo_url;
      }

      if (bandnewToken) {
        newToken = jwt.sign(
          tokenPayload,
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
      }
    }
    return res.status(200).json({
      success: true,
      mensaje: 'Empresa actualizada exitosamente',
      data: { cod_empresa },
      token: newToken
    });

  } catch (error) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    log_error.error('Error actualizando empresa:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar empresa',
      error: error.message
    });
  }
};