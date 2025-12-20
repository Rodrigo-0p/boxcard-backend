const path          = require('path');
const fs            = require('fs');
const { log_error } = require('../../../log/logger')
require('dotenv').config({path: path.join(__dirname,'..','..','..', '..', '.env'), quiet: true});
const BASE_DIR = path.join(process.cwd(), 'src', 'filestore');

exports.main = async (req, res) => {
  try {
    let { file_path  }     = req.query 
    let {logo_url = false} = req.user;
    logo_url = file_path ? file_path : logo_url;

    if (!logo_url) {
      return res.status(404).json({
        success: false,
        message:'Logo no registrado para esta empresa.'
      });
    }
    const filePath = path.join(BASE_DIR, logo_url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message:'Archivo de logo no encontrado en el servidor.'
      });
    }

    // Enviar el archivo de imagen
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error al enviar archivo:', err);
        log_error.error('Error enviando logo empresa', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error al enviar el archivo'
          });
        }
      }
    });

  } catch (error) {
    console.error('Error en imgLogoEmpresa:', error);
    log_error.error('imgLogoEmpresa', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};