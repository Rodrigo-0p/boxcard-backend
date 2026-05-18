const { executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.main = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { cod_menu, nombre_menu, icono, ruta, orden, cod_menu_padre, estado, isNew } = req.body;

        if (!nombre_menu || !estado) {
            return res.status(400).json({ success: false, message: 'Nombre y estado son requeridos' });
        }

        if (isNew) {
            const insertQuery = `
                INSERT INTO menus (cod_menu, nombre_menu, icono, ruta, orden, cod_menu_padre, estado)
                VALUES ((SELECT COALESCE(MAX(cod_menu), 0) + 1 FROM menus), $1, $2, $3, $4, $5, $6)
            `;
            await executeAdminQuery(adminUser, insertQuery, [nombre_menu, icono, ruta, orden || 1, cod_menu_padre, estado]);
        } else {
            const updateQuery = `
                UPDATE menus 
                SET nombre_menu = $1, icono = $2, ruta = $3, orden = $4, cod_menu_padre = $5, estado = $6
                WHERE cod_menu = $7
            `;
            await executeAdminQuery(adminUser, updateQuery, [nombre_menu, icono, ruta, orden, cod_menu_padre, estado, cod_menu]);
        }

        return res.status(200).json({
            success: true,
            message: `Menú ${isNew ? 'creado' : 'actualizado'} exitosamente`
        });
        
    } catch (error) {
        log_error.error('Error en SaveMenu:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al guardar el menú'
        });
    }
};
