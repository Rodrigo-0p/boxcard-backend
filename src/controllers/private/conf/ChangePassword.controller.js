const { executeAdminQuery } = require('../../../config/database');
const { log_error, log_info } = require('../../../log/logger');
const { buildAlterPasswordQuery, validatePasswordStrength } = require('../../../utils/sqlSecurity');
const { Client } = require('pg');

exports.main = async (req, res) => {
    try {
        const user = req.user; // From verifyToken middleware
        const { passwordActual, passwordNueva } = req.body;

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña actual y nueva son requeridas'
            });
        }

        // 1. Validar complejidad de la nueva contraseña
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

        // 2. Verificar contraseña actual intentando una conexión
        const testClient = new Client({
            user: user.username,
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME,
            password: passwordActual,
            port: process.env.DB_PORT || 5432,
            connectionTimeoutMillis: 5000,
        });

        try {
            await testClient.connect();
            await testClient.end();
        } catch (authError) {
            log_error.warn(`Cambio de contraseña fallido - Contraseña actual incorrecta para: ${user.username}`);
            return res.status(401).json({
                success: false,
                message: 'La contraseña actual es incorrecta'
            });
        }

        // 3. Cambiar contraseña en PostgreSQL
        try {
            const alterQuery = buildAlterPasswordQuery(user.username, passwordNueva);
            // Usamos null en el primer parámetro para que executeAdminQuery use las credenciales de sistema (.env)
            const resultAlter = await executeAdminQuery(null, alterQuery, []);
            
            if (!resultAlter.success) {
                log_error.error(`Error al ejecutar ALTER USER para ${user.username}:`, resultAlter.error);
                return res.status(500).json({
                    success: false,
                    message: 'Error al actualizar la contraseña en el motor de base de datos',
                    error: resultAlter.error
                });
            }
        } catch (pgError) {
            log_error.error(`Excepción al ejecutar ALTER USER para ${user.username}:`, pgError);
            return res.status(500).json({
                success: false,
                message: 'Error inesperado al actualizar la contraseña'
            });
        }

        // 4. Actualizar registro en la tabla personas
        const updatePersonaQuery = `
      UPDATE personas 
         SET ultimo_cambio_password = NOW(),
             password_temporal = 'N'
       WHERE usuario_pg = $1
    `;

        await executeAdminQuery(null, updatePersonaQuery, [user.username]);

        // 5. Regenerar Token JWT con la nueva contraseña
        const CryptoJS = require('crypto-js');
        const jwt = require('jsonwebtoken');
        const path = require('path');
        require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });

        const encryptPassword = (password) => {
            return CryptoJS.AES.encrypt(password, process.env.ENC_SECRET).toString();
        }

        const tokenPayload = { ...user };
        delete tokenPayload.exp;
        delete tokenPayload.iat;
        tokenPayload.enc_pwd = encryptPassword(passwordNueva);
        tokenPayload.login_time = require('moment')().format('DD/MM/YYYY HH:mm');

        const newToken = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        log_info.info(`Contraseña cambiada exitosamente para el usuario: ${user.username}`);

        return res.status(200).json({
            success: true,
            message: 'Contraseña actualizada exitosamente',
            token: newToken
        });

    } catch (error) {
        log_error.error('Error en ChangePassword.controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al cambiar la contraseña'
        });
    }
};
