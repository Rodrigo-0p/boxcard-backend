const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
require('dotenv').config();

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const adminUser = user;
        const userData = req.body;
        const { cod_persona, usuario_pg, password, rol_principal, roles_adicionales, menus_por_rol, es_password_temporal } = userData;


        if (!cod_persona || !usuario_pg) {
            return res.status(400).json({ success: false, message: 'Código de persona y usuario requeridos' });
        }

        const currentQuery = `SELECT usuario_pg FROM personas WHERE cod_persona = $1 AND cod_empresa = $2`;
        const currentResult = await executeQueryWithSession(user, currentQuery, [cod_persona, user.cod_empresa]);

        if (!currentResult.success || currentResult.data.length === 0) {
            return res.status(404).json({ success: false, message: 'Persona no encontrada en esta empresa' });
        }

        const usuario_pg_actual = currentResult.data[0].usuario_pg;
        const cod_empresa = user.cod_empresa;

        if (!usuario_pg_actual) {
            return res.status(400).json({ success: false, message: 'Esta persona no tiene un usuario asignado todavía' });
        }

        // 1. Actualizar contraseña si viene
        if (password && password.trim() !== '') {
            await executeAdminQuery(adminUser, `ALTER USER ${usuario_pg_actual} WITH PASSWORD '${password}'`, []);

            const updateQuery = `UPDATE personas SET password_temporal = $1, fecha_mod = NOW(), usuario_mod = $2 WHERE cod_persona = $3 AND cod_empresa = $4`;
            await executeQueryWithSession(user, updateQuery, [es_password_temporal === 'S' ? 'S' : 'N', user.username, parseInt(cod_persona), parseInt(cod_empresa)]);
        }

        // 2. Manejar Roles y Menús
        // Obtener rol principal anterior
        const currentRoleQuery = `
      SELECT r.rolname FROM pg_user u
      JOIN pg_auth_members m ON u.usesysid = m.member
      JOIN pg_roles r ON m.roleid = r.oid
      WHERE u.usename = $1 AND r.rolname LIKE 'rol_%'
      LIMIT 1
    `;
        const currentRoleResult = await executeAdminQuery(adminUser, currentRoleQuery, [usuario_pg_actual]);
        const rol_principal_anterior = (currentRoleResult.data && currentRoleResult.data.length > 0) ? currentRoleResult.data[0].rolname : null;

        // Actualizar Rol Principal en PG
        if (rol_principal && rol_principal_anterior && rol_principal !== rol_principal_anterior) {
            await executeAdminQuery(adminUser, `REVOKE ${rol_principal_anterior} FROM ${usuario_pg_actual}`, []);
            await executeAdminQuery(adminUser, `GRANT ${rol_principal} TO ${usuario_pg_actual}`, []);
        } else if (rol_principal && !rol_principal_anterior) {
            await executeAdminQuery(adminUser, `GRANT ${rol_principal} TO ${usuario_pg_actual}`, []);
        }

        // Actualizar Roles Adicionales en PG
        if (roles_adicionales !== undefined) {
            const currentRolesQuery = `
        SELECT r.rolname FROM pg_user u
        JOIN pg_auth_members m ON u.usesysid = m.member
        JOIN pg_roles r ON m.roleid = r.oid
        WHERE u.usename = $1 AND r.rolname LIKE 'rol_%' AND r.rolname != $2
      `;
            const currentRolesResult = await executeAdminQuery(adminUser, currentRolesQuery, [usuario_pg_actual, rol_principal || 'none']);
            const currentRoles = currentRolesResult.data.map(row => row.rolname);

            const newRoles = roles_adicionales || [];

            for (const rol of currentRoles) {
                if (!newRoles.includes(rol)) {
                    await executeAdminQuery(adminUser, `REVOKE ${rol} FROM ${usuario_pg_actual}`, []);
                }
            }

            for (const rol of newRoles) {
                if (!currentRoles.includes(rol)) {
                    await executeAdminQuery(adminUser, `GRANT ${rol} TO ${usuario_pg_actual}`, []);
                }
            }
        }

        // 3. Guardar Menús
        await guardarMenus(user, cod_empresa, usuario_pg_actual, userData, rol_principal_anterior);

        return res.status(200).json({
            success: true,
            message: 'Usuario actualizado exitosamente',
            data: { cod_persona }
        });

    } catch (error) {
        log_error.error('Error actualizando usuario:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar usuario', error: error.message });
    }
};

async function guardarMenus(user, cod_empresa, cod_usuario, userData, rol_principal_anterior) {
    const { rol_principal, roles_adicionales, menus_por_rol } = userData;

    // Si cambió el rol principal, limpiar menús anteriores de ese rol
    if (rol_principal && rol_principal_anterior && rol_principal !== rol_principal_anterior) {
        await executeQueryWithSession(user,
            'DELETE FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_role = $3',
            [cod_empresa, cod_usuario, rol_principal_anterior]
        );
    }

    const upsertMenuQuery = `
    INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (cod_empresa, usuario_pg, cod_role, cod_menu) 
    DO UPDATE SET estado = EXCLUDED.estado, fecha_alta = NOW()
  `;

    // ROL PRINCIPAL
    if (rol_principal) {
        const menusDelRol = await executeQueryWithSession(user, `SELECT cod_menu FROM roles_menus WHERE cod_role = $1 AND estado = 'A'`, [rol_principal]);
        const seleccionados = (menus_por_rol && menus_por_rol[rol_principal]) || [];

        for (const row of menusDelRol.data) {
            // Usamos comparación de strings para evitar problemas de tipos (int vs string)
            const estado = seleccionados.some(id => id.toString() === row.cod_menu.toString()) ? 'A' : 'I';
            await executeQueryWithSession(user, upsertMenuQuery, [cod_empresa, cod_usuario, rol_principal, row.cod_menu, estado]);
        }
    }

    // ROLES ADICIONALES - Sync
    if (roles_adicionales !== undefined) {
        // Obtener roles adicionales actuales en roles_menu_espec (distintos al principal)
        const currentRolesResult = await executeQueryWithSession(user,
            'SELECT DISTINCT cod_role FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_role != $3',
            [cod_empresa, cod_usuario, rol_principal || 'none']
        );
        const dbRoles = currentRolesResult.data.map(r => r.cod_role);

        // Eliminar los que ya no están
        for (const rol of dbRoles) {
            if (!roles_adicionales.includes(rol)) {
                await executeQueryWithSession(user, 'DELETE FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_role = $3', [cod_empresa, cod_usuario, rol]);
            }
        }

        // Upsert los nuevos
        for (const rol of roles_adicionales) {
            const menusDelRolAd = await executeQueryWithSession(user, `SELECT cod_menu FROM roles_menus WHERE cod_role = $1 AND estado = 'A'`, [rol]);
            const seleccionadosAd = (menus_por_rol && menus_por_rol[rol]) || [];

            for (const row of menusDelRolAd.data) {
                // Usamos comparación de strings para evitar problemas de tipos (int vs string)
                const estado = seleccionadosAd.some(id => id.toString() === row.cod_menu.toString()) ? 'A' : 'I';
                await executeQueryWithSession(user, upsertMenuQuery, [cod_empresa, cod_usuario, rol, row.cod_menu, estado]);
            }
        }
    }
}
