const { executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { cod_menu } = req.body;

        if (!cod_menu) {
            return res.status(400).json({ success: false, message: 'ID de menú requerido' });
        }

        // 1. Verificar si tiene hijos
        const checkChildrenQuery = `SELECT COUNT(*) as count FROM menus WHERE cod_menu_padre = $1`;
        const childrenResult = await executeAdminQuery(adminUser, checkChildrenQuery, [cod_menu]);
        
        if (parseInt(childrenResult.data[0].count) > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No se puede eliminar un menú que tiene sub-menús asignados' 
            });
        }

        // 2. Eliminar de roles_menus primero (Integridad Referencial)
        await executeAdminQuery(adminUser, `DELETE FROM roles_menus WHERE cod_menu = $1`, [cod_menu]);
        await executeAdminQuery(adminUser, `DELETE FROM roles_menu_espec WHERE cod_menu = $1`, [cod_menu]);

        // 3. Eliminar el menú
        const deleteQuery = `DELETE FROM menus WHERE cod_menu = $1`;
        await executeAdminQuery(adminUser, deleteQuery, [cod_menu]);

        return res.status(200).json({
            success: true,
            message: 'Menú eliminado correctamente'
        });
        
    } catch (error) {
        log_error.error('Error en DeleteMenu:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar el menú'
        });
    }
};
