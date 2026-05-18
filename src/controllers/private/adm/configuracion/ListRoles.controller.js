const { executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        
        // Listar roles que sigan el patrón del sistema 'rol_%'
        const query = `
            SELECT rolname as cod_role, 
                   rolname as nombre_role 
            FROM pg_roles 
            WHERE rolname LIKE 'rol_%'
            ORDER BY rolname ASC
        `;

        const result = await executeAdminQuery(adminUser, query, []);

        if (result.success) {
            return res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Error al listar roles'
            });
        }
    } catch (error) {
        log_error.error('Error en ListRoles:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
