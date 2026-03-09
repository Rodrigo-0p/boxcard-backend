const { log_error } = require('../log/logger');

/**
 * Escapa identificadores SQL para prevenir inyección
 * Solo usar para nombres de usuario, roles, etc (NO para passwords)
 */
const escapeIdentifier = (identifier) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Identificador inválido: ${identifier}`);
    }
    return identifier;
};

/**
 * Escapa literales de string SQL (passwords, etc)
 * Duplica comillas simples según estándar SQL
 */
const escapeLiteral = (value) => {
    if (typeof value !== 'string') {
        throw new Error('El valor debe ser string');
    }
    return value.replace(/'/g, "''");
};

/**
 * Valida la complejidad de una contraseña
 */
const validatePasswordStrength = (password) => {
    const errors = [];

    if (password.length < 8) {
        errors.push('La contraseña debe tener al menos 8 caracteres');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Debe contener al menos una mayúscula');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Debe contener al menos una minúscula');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Debe contener al menos un número');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Construye query segura para CREATE USER
 * @param {string} username - Nombre del usuario (validado)
 * @param {string} password - Contraseña
 * @returns {string} Query SQL seguro
 */
const buildCreateUserQuery = (username, password) => {
    try {
        const safeUsername = escapeIdentifier(username);
        const safePassword = escapeLiteral(password);

        return `CREATE USER ${safeUsername} WITH PASSWORD '${safePassword}'`;
    } catch (error) {
        log_error.error('Error construyendo query CREATE USER:', error);
        throw error;
    }
};

/**
 * Construye query segura para ALTER USER PASSWORD
 * @param {string} username - Nombre del usuario (validado)
 * @param {string} password - Nueva contraseña
 * @returns {string} Query SQL seguro
 */
const buildAlterPasswordQuery = (username, password) => {
    try {
        const safeUsername = escapeIdentifier(username);
        const safePassword = escapeLiteral(password);

        return `ALTER USER ${safeUsername} WITH PASSWORD '${safePassword}'`;
    } catch (error) {
        log_error.error('Error construyendo query ALTER USER:', error);
        throw error;
    }
};

/**
 * Construye query segura para GRANT
 * @param {string} role - Nombre del rol
 * @param {string} username - Nombre del usuario
 * @returns {string} Query SQL seguro
 */
const buildGrantQuery = (role, username) => {
    try {
        const safeRole = escapeIdentifier(role);
        const safeUsername = escapeIdentifier(username);

        return `GRANT ${safeRole} TO ${safeUsername}`;
    } catch (error) {
        log_error.error('Error construyendo query GRANT:', error);
        throw error;
    }
};

/**
 * Construye query segura para REVOKE
 * @param {string} role - Nombre del rol
 * @param {string} username - Nombre del usuario
 * @returns {string} Query SQL seguro
 */
const buildRevokeQuery = (role, username) => {
    try {
        const safeRole = escapeIdentifier(role);
        const safeUsername = escapeIdentifier(username);

        return `REVOKE ${safeRole} FROM ${safeUsername}`;
    } catch (error) {
        log_error.error('Error construyendo query REVOKE:', error);
        throw error;
    }
};

module.exports = {
    escapeIdentifier,
    escapeLiteral,
    validatePasswordStrength,
    buildCreateUserQuery,
    buildAlterPasswordQuery,
    buildGrantQuery,
    buildRevokeQuery
};
