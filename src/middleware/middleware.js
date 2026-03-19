const path = require('path');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const { log_info } = require('../log/logger');
// const { getSessionData } = require('../config/database');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Guardar temporalmente
    const tempPath = path.join(process.cwd(), 'src', 'filestore', 'temp');

    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }

    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `temp_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF)'));
  }
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

// ========================================
// RUTAS PÚBLICAS (NO REQUIEREN TOKEN)
// ========================================
const publicRoutes = [
  '/public/login',
  '/public/info-contacto',
  '/public/cambiar-password-temporal'
];

// ========================================
// MIDDLEWARE PRINCIPAL - DECIDE QUIÉN PASA
// ========================================
exports.authDecisionMiddleware = (req, res, next) => {
  const path = req.path;
  // Si es ruta pública, pasar sin validación
  if (publicRoutes.some(route => path.startsWith(route))) {
    return next();
  }
  // Si es ruta privada, validar token
  return exports.verifyToken(req, res, next);
};

// Descifra la contraseña
const decryptPassword = (encrypted) => {
  const bytes = CryptoJS.AES.decrypt(encrypted, process.env.ENC_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ========================================
// VERIFICAR TOKEN JWT
// ========================================
exports.verifyToken = (req, res, next) => {
  const token = req.headers['x-access-token'] ||
    req.headers['authorization']?.split(' ')[1];

  if (!token) {
    log_info.error(`No se proporcionó token`)
    return res.status(403).json({
      success: false,
      message: 'No se proporcionó token',
      code: 'NO_TOKEN'
    });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res
          .status(err.name === 'TokenExpiredError' ? 401 : 403)
          .json({
            success: false,
            message: err.name === 'TokenExpiredError'
              ? 'Token expirado'
              : 'Token inválido',
            code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
          });
      }

      // Token válido, agregar usuario al request
      decoded.password = decryptPassword(decoded.enc_pwd);
      req.user = decoded;
      log_info.info(`✅ Token válido para usuario: ${decoded.username} - Ruta: ${req.path}`)
      next();
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    });
  }
};