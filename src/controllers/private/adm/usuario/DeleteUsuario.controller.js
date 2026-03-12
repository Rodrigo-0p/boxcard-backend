const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
require('dotenv').config();

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const adminUser = user;
        const { cod_persona } = req.body;


        if (!cod_persona) {
            return res.status(400).json({ success: false, message: 'Código de persona requerido' });
        }

        const personaQuery = `SELECT usuario_pg FROM personas WHERE cod_persona = $1 AND cod_empresa = $2`;
        const personaResult = await executeQueryWithSession(user, personaQuery, [cod_persona, user.cod_empresa]);

        if (!personaResult.success || personaResult.data.length === 0) {
            return res.status(404).json({ success: false, message: 'Persona no encontrada en esta empresa o no tiene acceso' });
        }

        const usuario_pg = personaResult.data[0].usuario_pg;
        const cod_empresa = user.cod_empresa;

        if (!usuario_pg) {
            return res.status(400).json({ success: false, message: 'Esta persona no tiene un usuario asignado en esta empresa' });
        }

        // 1. Verificar sesiones activas
        const activeSessionsQuery = `SELECT COUNT(*) as count FROM pg_stat_activity WHERE usename = $1`;
        const sessionsResult = await executeAdminQuery(adminUser, activeSessionsQuery, [usuario_pg]);

        if (sessionsResult.data[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar el acceso porque el usuario tiene sesiones activas.'
            });
        }

        // 2. Limpiar campo usuario_pg en personas (SOLO PARA ESTA EMPRESA)
        const clearQuery = `UPDATE personas 
                            SET usuario_pg = NULL, 
                                password_temporal = 'N',
                                usuario_mod = $1,
                                fecha_mod = NOW()
                            WHERE cod_persona = $2 AND cod_empresa = $3`;
        await executeQueryWithSession(user, clearQuery, [user.username, cod_persona, cod_empresa]);

        // 3. Eliminar menús especiales
        await executeQueryWithSession(user, 'DELETE FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2', [cod_empresa, usuario_pg]);

        // 4. Eliminar usuario PostgreSQL SOLO si no está en uso en otra empresa
        try {
            const usageCheckQuery = `SELECT COUNT(*) as count FROM personas WHERE usuario_pg = $1`;
            const usageResult = await executeAdminQuery(adminUser, usageCheckQuery, [usuario_pg]);

            if (parseInt(usageResult.data[0].count) === 0) {
                // Revocar roles primero
                const revokeRolesQuery = `
                    SELECT r.rolname FROM pg_user u
                    JOIN pg_auth_members m ON u.usesysid = m.member
                    JOIN pg_roles r ON m.roleid = r.oid
                    WHERE u.usename = $1
                `;
                const rolesResult = await executeAdminQuery(adminUser, revokeRolesQuery, [usuario_pg]);

                if (rolesResult.data && rolesResult.data.length > 0) {
                    for (const roleRow of rolesResult.data) {
                        await executeAdminQuery(adminUser, `REVOKE ${roleRow.rolname} FROM ${usuario_pg}`, []);
                    }
                }

                await executeAdminQuery(adminUser, `DROP USER IF EXISTS ${usuario_pg}`, []);
            } else {
                // Si todavía se usa en otra empresa, solo revocar los roles/permisos que podrían ser específicos si los hay, 
                // pero como los roles son globales a nivel de BD, usualmente se mantienen si el usuario sigue existiendo.
                // Por ahora, si existe en otra empresa, no lo tocamos a nivel de ROLE en PG para no romper los otros accesos.
            }
        } catch (pgError) {
            log_error.error(`Error procesando usuario PostgreSQL ${usuario_pg}:`, pgError);
        }

        return res.status(200).json({
            success: true,
            message: 'Acceso de usuario eliminado exitosamente en esta empresa'
        });

    } catch (error) {
        log_error.error('Error eliminando usuario:', error);
        return res.status(500).json({ success: false, message: 'Error al eliminar usuario', error: error.message });
    }
};
