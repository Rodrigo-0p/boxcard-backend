const { executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');

exports.list = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        
        const query = `
            SELECT re.*, m.nombre_menu, p.descripcion as nombre_usuario
            FROM roles_menu_espec re
            JOIN menus m ON re.cod_menu = m.cod_menu
            JOIN personas p ON re.usuario_pg = p.usuario_pg
            WHERE re.estado = 'A' AND m.estado = 'A'
            ORDER BY re.fecha_alta DESC
        `;

        const result = await executeAdminQuery(adminUser, query, []);

        return res.status(200).json({
            success: true,
            data: result.data
        });
    } catch (error) {
        log_error.error('Error en ListSpecialPermissions:', error);
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
};

exports.save = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { cod_empresa, usuario_pg, cod_role, cod_menu } = req.body;

        if (!usuario_pg || !cod_menu || !cod_role) {
            return res.status(400).json({ success: false, message: 'Datos incompletos' });
        }

        const insertQuery = `
            INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
            VALUES ($1, $2, $3, $4, 'A', NOW())
            ON CONFLICT (cod_empresa, usuario_pg, cod_menu) 
            DO UPDATE SET estado = 'A', fecha_alta = NOW()
        `;

        await executeAdminQuery(adminUser, insertQuery, [cod_empresa || 1, usuario_pg, cod_role, cod_menu]);

        return res.status(200).json({
            success: true,
            message: 'Permiso especial asignado correctamente'
        });
    } catch (error) {
        log_error.error('Error en SaveSpecialPermission:', error);
        return res.status(500).json({ success: false, message: 'Fallo al guardar el permiso' });
    }
};

exports.delete = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { cod_empresa, usuario_pg, cod_menu } = req.body;

        const deleteQuery = `
            DELETE FROM roles_menu_espec 
            WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_menu = $3
        `;

        await executeAdminQuery(adminUser, deleteQuery, [cod_empresa || 1, usuario_pg, cod_menu]);

        return res.status(200).json({
            success: true,
            message: 'Permiso especial revocado correctamente'
        });
    } catch (error) {
        log_error.error('Error en DeleteSpecialPermission:', error);
        return res.status(500).json({ success: false, message: 'Error al revocar permiso' });
    }
};

exports.bulkSave = async (req, res) => {
    try {
        const adminUser = { username: process.env.DB_USER_UPDATE, password: process.env.DB_PASS_UPDATE };
        const { updates } = req.body; // Array de { usuario_pg, menus, cod_role }

        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ success: false, message: 'Datos de actualización inválidos' });
        }

        // Para cada usuario en la lista de actualizaciones
        for (const update of updates) {
            const { usuario_pg, menus, cod_role } = update;
            const cod_empresa = 1; // Default

            // 1. Eliminar permisos especiales actuales para este usuario
            const deleteQuery = `DELETE FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2`;
            await executeAdminQuery(adminUser, deleteQuery, [cod_empresa, usuario_pg]);

            // 2. Insertar los nuevos (si los hay)
            if (menus && menus.length > 0) {
                // Construir un multi-insert o ejecutar en bucle (el bucle es más seguro con executeAdminQuery)
                for (const cod_menu of menus) {
                    const insertQuery = `
                        INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
                        VALUES ($1, $2, $3, $4, 'A', NOW())
                    `;
                    // Nota: Usamos el cod_role que venga del update o uno genérico si no existe
                    await executeAdminQuery(adminUser, insertQuery, [cod_empresa, usuario_pg, cod_role || 'ADMIN', cod_menu]);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Estructura de navegación actualizada correctamente'
        });
    } catch (error) {
        log_error.error('Error en BulkSaveSpecialPermissions:', error);
        return res.status(500).json({ success: false, message: 'Error al realizar el guardado masivo' });
    }
};
