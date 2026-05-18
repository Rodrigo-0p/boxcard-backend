const { executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.getRoleMenus = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { cod_role } = req.params;

        const query = `
            SELECT rm.cod_menu 
            FROM roles_menus rm
            JOIN menus m ON rm.cod_menu = m.cod_menu
            WHERE rm.cod_role = $1 AND rm.estado = 'A' AND m.estado = 'A'
        `;

        const result = await executeAdminQuery(adminUser, query, [cod_role]);

        return res.status(200).json({
            success: true,
            data: result.data.map(r => r.cod_menu)
        });
    } catch (error) {
        log_error.error('Error en GetRoleMenus:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener menús del rol' });
    }
};

exports.saveRoleMenus = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { cod_role, menus } = req.body; // menus es un array de cod_menu

        if (!cod_role) return res.status(400).json({ success: false, message: 'Rol requerido' });

        // Borrar anteriores (o marcarlos como I)
        // Por simplicidad en este admin, borraremos y re-insertaremos los activos
        await executeAdminQuery(adminUser, `DELETE FROM roles_menus WHERE cod_role = $1`, [cod_role]);

        if (menus && menus.length > 0) {
            const insertQuery = `
                INSERT INTO roles_menus (cod_role, cod_menu, estado, fecha_alta, cod_usuario_alta)
                VALUES ($1, $2, 'A', NOW(), $3)
            `;
            const currentAdmin = req.user.username;
            for (const cod_menu of menus) {
                await executeAdminQuery(adminUser, insertQuery, [cod_role, cod_menu, currentAdmin]);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Permisos actualizados correctamente'
        });
        
    } catch (error) {
        log_error.error('Error en SaveRoleMenus:', error);
        return res.status(500).json({ success: false, message: 'Error al guardar permisos' });
    }
};

exports.saveBulkRoleMenus = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { updates } = req.body; // Array de { cod_role, menus }

        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ success: false, message: 'Se requiere un array de actualizaciones' });
        }

        const currentAdmin = req.user?.username || 'ADMIN';

        for (const update of updates) {
            const { cod_role, menus } = update;
            if (!cod_role) continue;

            // Limpiar permisos actuales del rol
            await executeAdminQuery(adminUser, `DELETE FROM roles_menus WHERE cod_role = $1`, [cod_role]);

            // Insertar nuevos permisos
            if (menus && menus.length > 0) {
                const insertQuery = `
                    INSERT INTO roles_menus (cod_role, cod_menu, estado, fecha_alta, cod_usuario_alta)
                    VALUES ($1, $2, 'A', NOW(), $3)
                `;
                for (const cod_menu of menus) {
                    await executeAdminQuery(adminUser, insertQuery, [cod_role, cod_menu, currentAdmin]);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Todos los cambios han sido guardados correcamente'
        });

    } catch (error) {
        log_error.error('Error en SaveBulkRoleMenus:', error);
        return res.status(500).json({ success: false, message: 'Error en el guardado masivo de roles' });
    }
};
