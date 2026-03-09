const jwt = require('jsonwebtoken');
const { authenticateAndGetUserData, executeWithUserConnection } = require('../../config/database');
const { buildAlterPasswordQuery, validatePasswordStrength } = require('../../utils/sqlSecurity');
const { log_error, log_info } = require('../../log/logger');
const moment = require('moment');
const CryptoJS = require('crypto-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env'), quiet: true });

// ========================================
// FUNCIÓN: CIFRA LA CONTRASEÑA
// ========================================
const encryptPassword = (password) => {
  return CryptoJS.AES.encrypt(password, process.env.ENC_SECRET).toString();
}

exports.login = async (req, res) => {
  try {
    const { username, password, nro_documento } = req.body;
    const clientIP = req.clientIP;

    // Validaciones básicas
    if (!username || !password || !nro_documento) {
      return res.status(400).json({
        success: false,
        message: 'Username, password y número de documento son requeridos',
      });
    }

    // Autenticar
    const authResult = await authenticateAndGetUserData(username, password, nro_documento);

    if (!authResult.success) {
      log_error.error(`Login fallido - Usuario: ${username} - Error: ${authResult.message} IP:${clientIP}`);
      return res.status(401).json({
        success: false,
        message: authResult.message,
      });
    }

    const usuario = authResult.data
    const { message, empresa_login, empresas_all } = authResult.data || authResult;

    // ✅ VALIDAR ESTADO DEL USUARIO
    if (usuario && usuario.estado !== 'A') {
      log_error.error(`Usuario inactivo - Usuario: ${username} - Estado: ${usuario.estado}`);
      return res.status(403).json({
        success: false,
        message: usuario.message || 'Usuario inactivo. Contacte al administrador.',
        code: 'USER_INACTIVE'
      });
    } else if (!authResult.success) {
      log_error.error(`Login fallido - Usuario: ${username} - Error: ${authResult.message} IP:${clientIP}`);
      return res.status(401).json({
        success: false,
        message: message,
      });
    }

    // ✅ VALIDAR ROL ASIGNADO
    if (!usuario.role || usuario.role === 'sin_rol') {
      log_error.error(`Usuario sin rol - Usuario: ${username}`);
      return res.status(403).json({
        success: false,
        message: 'Usuario sin rol asignado. Contacte al administrador.',
        code: 'NO_ROLE_ASSIGNED'
      });
    }

    // Encriptar password
    const encryptedPassword = encryptPassword(password);

    // ✅ GENERAR JWT TOKEN CON EMPRESAS EN EL PAYLOAD
    const tokenPayload = {
      cod_empresa: empresa_login.cod_empresa,
      ruc: empresa_login.ruc,
      cod_persona: usuario.cod_persona,
      username: usuario.usuario_pg,
      tip_empresa: empresa_login.tip_empresa,
      modalidad: empresa_login.modalidad,
      role: usuario.role,
      enc_pwd: encryptedPassword,
      empresas: empresas_all,
      logo_url: empresa_login.logo_url,
      login_time: moment().format('DD/MM/YYYY HH:mm'),
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    log_info.info(`Login exitoso - Usuario: ${username} - Empresa: ${empresa_login.nombre} - IP: ${clientIP}`);

    // ✅ RESPUESTA LIMPIA Y ESTRUCTURADA
    const requirePasswordChange = usuario.password_temporal === 'S';

    return res.status(200).json({
      success: true,
      message: 'Login exitoso',
      datas: {
        requirePasswordChange,
        token,
        user: {
          username: usuario.usuario_pg,
          descripcion: usuario.descripcion,
          correo: usuario.correo,
          login_time: tokenPayload.login_time
        },
        empresa: {
          empresa: empresa_login.empresa,
          ruc: empresa_login.ruc,
          tip_empresa: empresa_login.tip_empresa,
          modalidad: empresa_login.modalidad,
        }
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    log_error.error('login', error);

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// ========================================
// FUNCIÓN: CAMBIAR CONTRASEÑA TEMPORAL
// ========================================
exports.cambiarPasswordTemporal = async (req, res) => {
  try {
    const { username, passwordActual, passwordNueva, nro_documento } = req.body;

    if (!username || !passwordActual || !passwordNueva || !nro_documento) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos',
      });
    }

    const passwordValidation = validatePasswordStrength(passwordNueva);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña no cumple los requisitos de seguridad',
        errors: passwordValidation.errors
      });
    }

    if (passwordActual === passwordNueva) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual'
      });
    }

    // 1. Validar las credenciales actuales del usuario
    const authResult = await authenticateAndGetUserData(username, passwordActual, nro_documento);
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta o los datos no coinciden',
      });
    }

    // El superusuario (DB_USER_UPDATE) o el administrador necesario para ejecutar sentencias preparadas de update.
    const userUpdate = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };

    // 2. Conectarse y enviar la nueva contraseña con ALTER USER
    await executeWithUserConnection(userUpdate.username, userUpdate.password, async (client) => {
      const alterQuery = buildAlterPasswordQuery(username, passwordNueva);
      await client.query(alterQuery);

      const updatePersonaQuery = `
        UPDATE personas 
           SET ultimo_cambio_password = NOW(),
               password_temporal = 'N'
         WHERE usuario_pg = $1
      `;
      await client.query(updatePersonaQuery, [username]);
    });

    log_info.info(`Contraseña temporal cambiada exitosamente para el usuario: ${username}`);

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });

  } catch (error) {
    console.error('Error al cambiar contraseña temporal:', error);
    log_error.error('cambiar_password_temporal', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};
