const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
const { nvl } = require('../../../../utils/main');
require('dotenv').config();

exports.main = async (req, res) => {
  try {
    const user = req.user;
    const personaData = req.body;
    const adminUser = user;

    if (nvl(personaData.usuario_pg, null) !== null && (!personaData.password || !personaData.rol_principal)) {
      return res.status(400).json({
        success: false,
        message: 'Usuario, contraseña y rol principal son requeridos'
      });
    }

    if (!personaData.cod_empresa) {
      return res.status(400).json({
        success: false,
        message: 'Empresa es requerida'
      });
    }

    const maxResult = await executeQueryWithSession(
      user,
      'SELECT COALESCE(MAX(cod_persona), 0) + 1 as next_code FROM personas',
      []
    );

    const next_cod = maxResult.data[0].next_code;

    const insertQuery = `
      INSERT INTO personas (
          cod_persona
        , descripcion
        , usuario_pg
        , nro_documento
        , nro_telef
        , correo
        , cod_empresa
        , estado
        , password_temporal
        , fecha_alta      
      ) VALUES ( 
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) 
      RETURNING cod_persona
    `;

    const params = [
      next_cod,
      personaData.descripcion,
      personaData.usuario_pg,
      personaData.nro_documento,
      personaData.nro_telef,
      personaData.correo,
      personaData.cod_empresa,
      personaData.estado || 'A',
      personaData.es_password_temporal === 'S' ? 'S' : 'N'
    ];

    const result = await executeQueryWithSession(user, insertQuery, params);

    if (!result.success || !result.data[0]) {
      throw new Error('Error al crear persona');
    }

    const cod_persona = result.data[0].cod_persona;

    // SOLO GUARDAR MENÚS SI TIENE USUARIO
    if (personaData.usuario_pg) {

      const userExistsQuery = 'SELECT 1 FROM pg_user WHERE usename = $1';
      const userExists = await executeAdminQuery(adminUser, userExistsQuery, [personaData.usuario_pg]);

      if (userExists.data && userExists.data.length > 0) {
        await executeQueryWithSession(user, 'DELETE FROM personas WHERE cod_persona = $1', [cod_persona]);
        return res.status(400).json({
          success: false,
          message: `El usuario '${personaData.usuario_pg}' ya existe en el sistema`
        });
      }

      await executeAdminQuery(adminUser, `CREATE USER ${personaData.usuario_pg} WITH PASSWORD '${personaData.password}'`, []);
      await executeAdminQuery(adminUser, `GRANT ${personaData.rol_principal} TO ${personaData.usuario_pg}`, []);

      if (personaData.roles_adicionales && personaData.roles_adicionales.length > 0) {
        for (const rol of personaData.roles_adicionales) {
          await executeAdminQuery(adminUser, `GRANT ${rol} TO ${personaData.usuario_pg}`, []);
        }
      }

      // GUARDAR MENÚS - ROL PRINCIPAL
      if (personaData.rol_principal) {
        const menusDelRolQuery = `
          SELECT cod_menu 
          FROM roles_menus 
          WHERE cod_role = $1 AND estado = 'A'
          ORDER BY cod_menu
        `;
        const menusDelRol = await executeQueryWithSession(user, menusDelRolQuery, [personaData.rol_principal]);
        const menusSeleccionados = (personaData.menus_por_rol && personaData.menus_por_rol[personaData.rol_principal]) || [];

        // UPSERT usando usuario_pg (usuario_pg)
        const upsertMenuQuery = `
          INSERT INTO roles_menu_espec (cod_empresa, usuario_pg, cod_role, cod_menu, estado, fecha_alta)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (cod_empresa, usuario_pg, cod_role, cod_menu) 
          DO UPDATE SET estado = EXCLUDED.estado, fecha_alta = NOW()
        `;

        for (const menuRow of menusDelRol.data) {
          const estadoMenu = menusSeleccionados.includes(menuRow.cod_menu) ? 'A' : 'I';
          await executeQueryWithSession(user, upsertMenuQuery, [
            personaData.cod_empresa,
            personaData.usuario_pg,  // ← usuario_pg
            personaData.rol_principal,
            menuRow.cod_menu,
            estadoMenu
          ]);
        }
      }

      // GUARDAR MENÚS - ROLES ADICIONALES
      if (personaData.roles_adicionales && personaData.roles_adicionales.length > 0) {
        for (const rol of personaData.roles_adicionales) {
          const menusDelRolQuery = `
            SELECT cod_menu 
            FROM roles_menus 
            WHERE cod_role = $1 AND estado = 'A'
            ORDER BY cod_menu
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
              personaData.cod_empresa,
              personaData.usuario_pg,  // ← cod_usuario
              rol,
              menuRow.cod_menu,
              estadoMenu
            ]);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Persona creada exitosamente',
      data: { cod_persona }
    });

  } catch (error) {
    log_error.error('Error creando persona:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear persona',
      error: error.message
    });
  }
};