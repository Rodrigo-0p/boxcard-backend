const { executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        
        const { soloActivos } = req.query;
        let whereClause = '';
        if (soloActivos === 'true') {
            whereClause = "WHERE m.estado = 'A'";
        }

        const query = `
            SELECT 
                cod_menu, 
                nombre_menu, 
                icono, 
                ruta, 
                orden, 
                cod_menu_padre, 
                estado,
                (SELECT nombre_menu FROM menus m2 WHERE m2.cod_menu = m.cod_menu_padre) as nombre_padre
            FROM menus m
            ${whereClause}
            ORDER BY m.cod_menu_padre NULLS FIRST, m.orden ASC
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
                message: 'Error al listar menús'
            });
        }
    } catch (error) {
        log_error.error('Error en ListMenus:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};
