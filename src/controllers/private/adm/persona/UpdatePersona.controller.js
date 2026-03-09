const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
require('dotenv').config();

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const adminUser = user;
    const { cod_persona, ...personaData } = req.body;

    if (!cod_persona) {
      return res.status(400).json({ success: false, message: 'Código de persona requerido' });
    }

    const currentQuery = `SELECT usuario_pg
                               , descripcion
                               , cod_empresa 
                            FROM personas 
                           WHERE cod_persona = $1`;
    const currentResult = await executeQueryWithSession(user, currentQuery, [cod_persona]);

    if (!currentResult.success || currentResult.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    const usuario_pg_actual = currentResult.data[0].usuario_pg;
    const cod_empresa_actual = currentResult.data[0].cod_empresa;

    // CASO 1: NO tenía usuario y ahora se está agregando uno
    if (!usuario_pg_actual && personaData.usuario_pg) {

      if (!personaData.password) {
        return res.status(400).json({ success: false, message: 'Contraseña es requerida para crear el usuario' });
      }
      if (!personaData.rol_principal) {
        return res.status(400).json({ success: false, message: 'Rol principal es requerido para crear el usuario' });
      }

      const userExistsQuery = `SELECT 1 
                                 FROM pg_user 
                                WHERE usename = $1`;
      const userExists = await executeAdminQuery(adminUser, userExistsQuery, [personaData.usuario_pg]);

      if (userExists.data && userExists.data.length > 0) {
        return res.status(400).json({ success: false, message: `El usuario '${personaData.usuario_pg}' ya existe en el sistema` });
      }

      try {
        await executeAdminQuery(adminUser, `CREATE USER ${personaData.usuario_pg} WITH PASSWORD '${personaData.password}'`, []);

        if (personaData.rol_principal) {
          await executeAdminQuery(adminUser, `GRANT ${personaData.rol_principal} TO ${personaData.usuario_pg}`, []);
        }

        if (personaData.roles_adicionales && personaData.roles_adicionales.length > 0) {
          for (const rol of personaData.roles_adicionales) {
            await executeAdminQuery(adminUser, `GRANT ${rol} TO ${personaData.usuario_pg}`, []);
          }
        }
      } catch (pgError) {
        log_error.error('Error creando usuario PostgreSQL:', pgError);
        return res.status(500).json({ success: false, message: 'Error al crear usuario PostgreSQL', error: pgError.message });
      }

      const updateQuery = `
        UPDATE personas SET descripcion   = $1
                          , nro_documento = $2
                          , nro_telef     = $3
                          , correo        = $4
                          , cod_empresa   = $5
                          , estado        = $6
                          , usuario_pg    = $7
                          , password_temporal = $8
                          , fecha_mod     = NOW()
        WHERE cod_persona = $9
      `;

      const params = [
        personaData.descripcion, personaData.nro_documento, personaData.nro_telef, personaData.correo,
        personaData.cod_empresa, personaData.estado || 'A', personaData.usuario_pg,
        personaData.es_password_temporal === 'S' ? 'S' : 'N', cod_persona
      ];

      const result = await executeQueryWithSession(user, updateQuery, params);

      if (!result.success) {
        try {
          await executeAdminQuery(adminUser, `DROP USER IF EXISTS ${personaData.usuario_pg}`, []);
        } catch (cleanupError) {
          log_error.error('Error limpiando usuario:', cleanupError);
        }
        throw new Error('Error al actualizar persona');
      }

      // GUARDAR MENÚS - CASO 1
      await guardarMenus(user, personaData.cod_empresa, personaData.usuario_pg, personaData, null, null);

    }
    // CASO 2: YA tenía usuario
    else {
      let updateQuery = `
        UPDATE personas SET descripcion = $1, nro_documento = $2, nro_telef = $3, correo = $4,
                            cod_empresa = $5, estado = $6, fecha_mod = NOW()
      `;

      const params = [
        personaData.descripcion, personaData.nro_documento, personaData.nro_telef,
        personaData.correo, personaData.cod_empresa, personaData.estado || 'A'
      ];

      let paramCount = 7;
      if (personaData.password && personaData.password.trim() !== '') {
        updateQuery += `, password_temporal = $${paramCount}`;
        params.push(personaData.es_password_temporal === 'S' ? 'S' : 'N');
        paramCount++;
      }

      updateQuery += ` WHERE cod_persona = $${paramCount}`;
      params.push(cod_persona);

      const result = await executeQueryWithSession(user, updateQuery, params);

      if (!result.success) {
        throw new Error('Error al actualizar persona');
      }

      // Obtener rol_principal ANTERIOR
      let rol_principal_anterior = null;
      if (usuario_pg_actual) {
        const currentRoleQuery = `
          SELECT r.rolname FROM pg_user u
          JOIN pg_auth_members m ON u.usesysid = m.member
          JOIN pg_roles r ON m.roleid = r.oid
          WHERE u.usename = $1 AND r.rolname LIKE 'rol_%'
          LIMIT 1
        `;
        const currentRole = await executeAdminQuery(adminUser, currentRoleQuery, [usuario_pg_actual]);
        rol_principal_anterior = currentRole.data && currentRole.data.length > 0 ? currentRole.data[0].rolname : null;
      }

      if (usuario_pg_actual && (personaData.password || personaData.rol_principal || personaData.roles_adicionales)) {
        if (personaData.password && personaData.password.trim() !== '') {
          await executeAdminQuery(adminUser, `ALTER USER ${usuario_pg_actual} WITH PASSWORD '${personaData.password}'`, []);
        }

        if (personaData.rol_principal && rol_principal_anterior && personaData.rol_principal !== rol_principal_anterior) {
          // CAMBIÓ EL ROL PRINCIPAL
          await executeAdminQuery(adminUser, `REVOKE ${rol_principal_anterior} FROM ${usuario_pg_actual}`, []);
          await executeAdminQuery(adminUser, `GRANT ${personaData.rol_principal} TO ${usuario_pg_actual}`, []);
        } else if (personaData.rol_principal && !rol_principal_anterior) {
          // NO TENÍA ROL, ASIGNAR
          await executeAdminQuery(adminUser, `GRANT ${personaData.rol_principal} TO ${usuario_pg_actual}`, []);
        }

        if (personaData.roles_adicionales !== undefined) {
          const currentRolesQuery = `
            SELECT r.rolname FROM pg_user u
            JOIN pg_auth_members m ON u.usesysid = m.member
            JOIN pg_roles r ON m.roleid = r.oid
            WHERE u.usename = $1 AND r.rolname LIKE 'rol_%' AND r.rolname != $2
          `;
          const currentRolesResult = await executeAdminQuery(adminUser, currentRolesQuery, [usuario_pg_actual, personaData.rol_principal || 'none']);
          const currentRoles = currentRolesResult.data.map(row => row.rolname);
          const newRoles = personaData.roles_adicionales || [];

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
      }

      // GUARDAR MENÚS - CASO 2
      if (usuario_pg_actual) {
        await guardarMenus(user, personaData.cod_empresa, usuario_pg_actual, personaData, rol_principal_anterior, cod_empresa_actual);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Persona actualizada exitosamente',
      data: { cod_persona }
    });

  } catch (error) {
    log_error.error('Error actualizando persona:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar persona', error: error.message });
  }
};

// FUNCIÓN AUXILIAR - Con cod_empresa y detección de cambio de rol
async function guardarMenus(user, cod_empresa, cod_usuario, personaData, rol_principal_anterior, cod_empresa_anterior) {

  // DETECTAR CAMBIO DE EMPRESA → Eliminar TODOS los menús de la empresa anterior
  if (cod_empresa_anterior && cod_empresa !== cod_empresa_anterior) {
    await executeQueryWithSession(user,
      'DELETE FROM roles_menu_espec WHERE usuario_pg = $1 AND cod_empresa = $2',
      [cod_usuario, cod_empresa_anterior]
    );
  }

  // DETECTAR CAMBIO DE ROL PRINCIPAL → Eliminar menús del rol anterior
  if (personaData.rol_principal && rol_principal_anterior && personaData.rol_principal !== rol_principal_anterior) {
    await executeQueryWithSession(user,
      'DELETE FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_role = $3',
      [cod_empresa, cod_usuario, rol_principal_anterior]
    );
  }

  // GUARDAR MENÚS DEL ROL PRINCIPAL (nuevo o actualizado)
  if (personaData.rol_principal) {
    const menusDelRolQuery = `
      SELECT cod_menu FROM roles_menus WHERE cod_role = $1 AND estado = 'A' ORDER BY cod_menu
    `;
    const menusDelRol = await executeQueryWithSession(user, menusDelRolQuery, [personaData.rol_principal]);
    const menusSeleccionados = (personaData.menus_por_rol && personaData.menus_por_rol[personaData.rol_principal]) || [];

    const upsertMenuQuery = `
      INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (cod_empresa, usuario_pg, cod_role, cod_menu) 
      DO UPDATE SET estado = EXCLUDED.estado, fecha_alta = NOW()
    `;

    for (const menuRow of menusDelRol.data) {
      const estadoMenu = menusSeleccionados.includes(menuRow.cod_menu) ? 'A' : 'I';
      await executeQueryWithSession(user, upsertMenuQuery, [
        cod_empresa,                // ← cod_empresa
        cod_usuario,
        personaData.rol_principal,
        menuRow.cod_menu,
        estadoMenu
      ]);
    }
  }

  // ROLES ADICIONALES - Eliminar los que ya no están
  if (personaData.roles_adicionales !== undefined) {
    // Obtener roles adicionales actuales (excluyendo rol principal)
    const currentRolesQuery = `
      SELECT DISTINCT cod_role FROM roles_menu_espec 
      WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_role != $3
    `;
    const currentRolesResult = await executeQueryWithSession(user, currentRolesQuery, [
      cod_empresa,
      cod_usuario,
      personaData.rol_principal || 'none'
    ]);
    const currentRoles = currentRolesResult.data.map(r => r.cod_role);

    // Eliminar roles que ya no están en la lista
    for (const rol of currentRoles) {
      if (!personaData.roles_adicionales.includes(rol)) {
        await executeQueryWithSession(user,
          'DELETE FROM roles_menu_espec WHERE cod_empresa = $1 AND usuario_pg = $2 AND cod_role = $3',
          [cod_empresa, cod_usuario, rol]
        );
      }
    }

    // Agregar/actualizar roles adicionales nuevos
    for (const rol of personaData.roles_adicionales) {
      const menusDelRolQuery = `
        SELECT cod_menu FROM roles_menus WHERE cod_role = $1 AND estado = 'A' ORDER BY cod_menu
      `;
      const menusDelRol = await executeQueryWithSession(user, menusDelRolQuery, [rol]);
      const menusSeleccionados = (personaData.menus_por_rol && personaData.menus_por_rol[rol]) || [];

      const upsertMenuQuery = `
        INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (cod_empresa, usuario_pg, cod_role, cod_menu) 
        DO UPDATE SET estado = EXCLUDED.estado, fecha_alta = NOW()
      `;

      for (const menuRow of menusDelRol.data) {
        const estadoMenu = menusSeleccionados.includes(menuRow.cod_menu) ? 'A' : 'I';
        await executeQueryWithSession(user, upsertMenuQuery, [
          cod_empresa,    // ← cod_empresa
          cod_usuario,
          rol,
          menuRow.cod_menu,
          estadoMenu
        ]);
      }
    }
  }
}