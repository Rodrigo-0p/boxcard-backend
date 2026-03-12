const rateLimit = require('express-rate-limit');
const { log_login_limit, log_password_limit, log_error } = require('../log/logger');
const moment = require('moment');
const { executeAdminQuery } = require('../config/database');

// ========================================
// STORES PARA PODER REINICIAR LOS LÍMITES
// ========================================
// Usamos MemoryStore por defecto pero los guardamos en variables 
// para poder acceder a ellos y limpiarlos con el comando de reset.
const loginStore = new rateLimit.MemoryStore();
const passwordStore = new rateLimit.MemoryStore();

/**
 * Función para resetear todos los límites
 */
const resetAllRateLimits = () => {
    if (loginStore.resetAll) loginStore.resetAll();
    if (passwordStore.resetAll) passwordStore.resetAll();
    return true;
};

// ========================================
// RATE LIMITER PARA LOGIN
// ========================================
const loginLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES || '15') * 60 * 1000,
    max: parseInt(process.env.loginLimiter || process.env.LOGIN_LIMITER || process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS || '5'),
    store: loginStore,
    message: {
        success: false,
        message: 'Demasiados intentos de login. Por favor intenta nuevamente más tarde.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = req.clientIP || req.ip;
        const username = req.body.username || 'unknown';
        return `${ip}_${username}`;
    },
    skipSuccessfulRequests: true,
    validate: { ip: false },
    handler: async (req, res, next, options) => {
        const ip = req.clientIP || req.ip;
        const username = req.body.username || 'unknown';
        const now = moment().format('DD/MM/YYYY HH:mm:ss');
        
        log_login_limit.info(`[${now}] BLOQUEO LOGIN (Persistent): IP=${ip} | Usuario=${username}`);

        // Persistir bloqueo en BD si tenemos el usuario
        if (username !== 'unknown') {
            try {
                const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
                const updateQuery = `UPDATE personas SET fecha_password_temp = NOW() WHERE usuario_pg = $1`;
                await executeAdminQuery(adminUser, updateQuery, [username]);
            } catch (err) {
                log_error.error(`Error persistiendo bloqueo para ${username}: ${err.message}`);
            }
        }

        res.status(options.statusCode).send(options.message);
    }
});

const passwordChangeLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_WINDOW_MINUTES || '15') * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_PASSWORD_MAX_ATTEMPTS || '3'),
    store: passwordStore,
    message: {
        success: false,
        message: 'Demasiados intentos de cambio de contraseña. Por favor intenta nuevamente más tarde.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const ip = req.clientIP || req.ip;
        const username = req.body.username || 'unknown';
        return `pwd_${ip}_${username}`;
    },
    skipSuccessfulRequests: true,
    validate: { ip: false },
    handler: async (req, res, next, options) => {
        const ip = req.clientIP || req.ip;
        const username = req.body.username || 'unknown';
        const now = moment().format('DD/MM/YYYY HH:mm:ss');

        log_password_limit.info(`[${now}] BLOQUEO PASSWORD (Persistent): IP=${ip} | Usuario=${username}`);

        // Persistir bloqueo en BD
        if (username !== 'unknown') {
            try {
                const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
                const updateQuery = `UPDATE personas SET fecha_password_temp = NOW() WHERE usuario_pg = $1`;
                await executeAdminQuery(adminUser, updateQuery, [username]);
            } catch (err) {
                log_error.error(`Error persistiendo bloqueo password para ${username}: ${err.message}`);
            }
        }

        res.status(options.statusCode).send(options.message);
    }
});

// ========================================
// RATE LIMITER GENERAL PARA API
// ========================================
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MINUTES || '1') * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_API_MAX_REQUESTS || '100'),
    message: {
        success: false,
        message: 'Demasiadas peticiones. Por favor espera un momento.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
});

// ========================================
// RATE LIMITER ESTRICTO PARA OPERACIONES SENSIBLES
// ========================================
const strictLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_STRICT_WINDOW_MINUTES || '1') * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_STRICT_MAX_OPERATIONS || '10'),
    message: {
        success: false,
        message: 'Límite de operaciones alcanzado. Por favor espera un momento.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.clientIP || req.ip;
    },
    validate: { ip: false },
});

module.exports = {
    loginLimiter,
    passwordChangeLimiter,
    apiLimiter,
    strictLimiter,
    resetAllRateLimits // Exportar para poder usarlo desde el servidor
};

