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
            await executeAdminQuery(user, alterQuery, []);
        } catch (pgError) {
            log_error.error(`Error al ejecutar ALTER USER para ${user.username}:`, pgError);
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar la contraseña en el motor de base de datos'
            });
        }

        // 4. Actualizar registro en la tabla personas
        const updatePersonaQuery = `
      UPDATE personas 
         SET ultimo_cambio_password = NOW(),
             password_temporal = 'N'
       WHERE usuario_pg = $1
    `;

        await executeAdminQuery(user, updatePersonaQuery, [user.username]);

        log_info.info(`Contraseña cambiada exitosamente para el usuario: ${user.username}`);

        return res.status(200).json({
            success: true,
            message: 'Contraseña actualizada exitosamente'
        });

    } catch (error) {
        log_error.error('Error en ChangePassword.controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al cambiar la contraseña'
        });
    }
};
