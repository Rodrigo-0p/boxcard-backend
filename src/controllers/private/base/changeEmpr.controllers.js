
const path        = require('path');
const jwt         = require('jsonwebtoken');
const {log_error} = require('../../../log/logger')

require('dotenv').config({path: path.join(__dirname,'..','..','..', '..', '.env'), quiet: true});

exports.main = async (req, res) => {
  try {
    const user = req.user;  // Ya viene del middleware (token desencriptado)

    // ✅ Las empresas están en el token
    if (!user.empresas || user.empresas.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No tiene más empresas asociadas',
        datas: {
          empresas : [],
          total    : 0
        }
      });
    }

    if (user.empresas.length === 1) {
      return res.status(200).json({
        success: false,
        message: 'Solo tiene una empresa asociada',
        datas: {
          empresas: user.empresas,
          total: 1,
          empresa_actual: user.cod_empresa
        }
      });
    }

    // ✅ Devolver empresas
    return res.status(200).json({
      success: true,
      message: 'Empresas disponibles',
      datas: {
        empresas      : user.empresas,
        total         : user.empresas.length,
        empresa_actual: user.cod_empresa
      }
    });

  } catch (error) {
    console.error('Error en getEmpresas:', error);
    log_error.error('getEmpresas', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

exports.updateEmpresa = async (req, res) => {
  try {
    const vempresa = req.body;
    const user     = req.user;
    const tokenPayload = { ...user,...vempresa };
    
    delete tokenPayload.exp;
    delete tokenPayload.iat;
    delete tokenPayload.password;

    newToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
   
    // const user     = req.user;
    // delete user.exp;     // Removes expiration time
    // delete user.iat;     // Removes issued at time
    // delete user.password // eliminamos el pass descriptada.
    // user.cod_empresa   = vempresa.cod_empresa
    // user.empresa       = vempresa.empresa;
    // user.ruc           = vempresa.ruc;
    // user.tip_empresa   = vempresa.tip_empresa;
    // user.modalidad     = vempresa.modalidad;
    // user.limit_venc    = vempresa.limit_venc;
    // user.logo_url      = vempresa.logo_url;
    // const tokenPayload = user;
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Empresa cambiada exitosamente',
      datas: {token}
    });

  } catch (error) {
    console.error('Error en updateEmpresa:', error);
    log_error.error('updateEmpresa', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};