const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
const { nvl } = require('../../../../utils/main');
require('dotenv').config();

exports.main = async (req, res) => {
    try {
        const user = req.user;
        const userData = req.body;
        const adminUser = user;

        const { cod_persona, usuario_pg, password, rol_principal, roles_adicionales, menus_por_rol, es_password_temporal } = userData;


        if (!cod_persona || !usuario_pg || !password || !rol_principal) {
            return res.status(400).json({
                success: false,
                message: 'Persona, Usuario, contraseña y rol principal son requeridos'
            });
        }

        // 1. Verificar si la persona ya tiene un usuario asignado en la base de datos
        const checkPersonaQuery = 'SELECT usuario_pg FROM personas WHERE cod_persona = $1 AND cod_empresa = $2';
        const checkPersona = await executeQueryWithSession(user, checkPersonaQuery, [cod_persona, user.cod_empresa]);

        if (!checkPersona.success || checkPersona.data.length === 0) {
            return res.status(404).json({ success: false, message: 'Persona no encontrada' });
        }

        if (checkPersona.data[0].usuario_pg) {
            return res.status(400).json({ success: false, message: 'Esta persona ya tiene un usuario asignado' });
        }

        const cod_empresa = user.cod_empresa;

        // 2. Verificar si el usuario ya existe en PostgreSQL
        const userExistsQuery = 'SELECT 1 FROM pg_user WHERE usename = $1';
        const userExists = await executeAdminQuery(adminUser, userExistsQuery, [usuario_pg]);

        if (userExists.data && userExists.data.length > 0) {
            return res.status(400).json({
                success: false,
                message: `El usuario '${usuario_pg}' ya existe en el sistema`
            });
        }

        // 3. Crear usuario en PostgreSQL
        await executeAdminQuery(adminUser, `CREATE USER ${usuario_pg} WITH PASSWORD '${password}'`, []);
        await executeAdminQuery(adminUser, `GRANT ${rol_principal} TO ${usuario_pg}`, []);

        if (roles_adicionales && roles_adicionales.length > 0) {
            for (const rol of roles_adicionales) {
                await executeAdminQuery(adminUser, `GRANT ${rol} TO ${usuario_pg}`, []);
            }
        }

        // 4. Actualizar tabla personas
        const updateQuery = `
      UPDATE personas 
      SET usuario_pg = $1, 
          password_temporal = $2,
          fecha_mod = NOW(),
          usuario_mod = $5
      WHERE cod_persona = $3 AND cod_empresa = $4
    `;
        const updateResult = await executeQueryWithSession(user, updateQuery, [
            usuario_pg,
            es_password_temporal === 'S' ? 'S' : 'N',
            parseInt(cod_persona),
            parseInt(user.cod_empresa),
            user.username
        ]);

        if (!updateResult.success) {
            // Cleanup cleanup
            await executeAdminQuery(adminUser, `DROP USER IF EXISTS ${usuario_pg}`, []);
            throw new Error('Error al asignar usuario a la persona');
        }

        // 5. Guardar menús
        await guardarMenus(user, cod_empresa, usuario_pg, userData);

        return res.status(200).json({
            success: true,
            message: 'Usuario creado exitosamente',
            data: { cod_persona }
        });

    } catch (error) {
        log_error.error('Error creando usuario:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear usuario',
            error: error.message
        });
    }
};

async function guardarMenus(user, cod_empresa, cod_usuario, userData) {
    const { rol_principal, roles_adicionales, menus_por_rol } = userData;

    // ROL PRINCIPAL
    const menusDelRolQuery = `
    SELECT cod_menu FROM roles_menus WHERE cod_role = $1 AND estado = 'A' ORDER BY cod_menu
  `;
    const menusDelRol = await executeQueryWithSession(user, menusDelRolQuery, [rol_principal]);
    const menusSeleccionadosPrincipal = (menus_por_rol && menus_por_rol[rol_principal]) || [];

    const upsertMenuQuery = `
    INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (cod_empresa, usuario_pg, cod_role, cod_menu) 
    DO UPDATE SET estado = EXCLUDED.estado, fecha_alta = NOW()
  `;

    for (const menuRow of menusDelRol.data) {
        // Usamos comparación de strings para evitar problemas de tipos (int vs string)
        const estadoMenu = menusSeleccionadosPrincipal.some(id => id.toString() === menuRow.cod_menu.toString()) ? 'A' : 'I';
        await executeQueryWithSession(user, upsertMenuQuery, [
            cod_empresa,
            cod_usuario,
            rol_principal,
            menuRow.cod_menu,
            estadoMenu
        ]);
    }

    // ROLES ADICIONALES
    if (roles_adicionales && roles_adicionales.length > 0) {
        for (const rol of roles_adicionales) {
            const menusDelRolAdQuery = `
        SELECT cod_menu FROM roles_menus WHERE cod_role = $1 AND estado = 'A' ORDER BY cod_menu
      `;
            const menusDelRolAd = await executeQueryWithSession(user, menusDelRolAdQuery, [rol]);
            const menusSeleccionadosAd = (menus_por_rol && menus_por_rol[rol]) || [];

            for (const menuRow of menusDelRolAd.data) {
                // Usamos comparación de strings para evitar problemas de tipos (int vs string)
            const estadoMenu = menusSeleccionadosAd.some(id => id.toString() === menuRow.cod_menu.toString()) ? 'A' : 'I';
                await executeQueryWithSession(user, upsertMenuQuery, [
                    cod_empresa,
                    cod_usuario,
                    rol,
                    menuRow.cod_menu,
                    estadoMenu
                ]);
            }
        }
    }
}
