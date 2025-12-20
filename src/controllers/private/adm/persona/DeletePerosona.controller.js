const { executeQueryWithSession, executeAdminQuery } = require('../../../../config/database');
const { log_error } = require('../../../../log/logger');
require('dotenv').config();

exports.main = async (req, res) => {
  try {
    const user      = req.user;
    const adminUser = user;
    const { cod_persona } = req.body;

    if (!cod_persona) {
      return res.status(400).json({ success: false, message: 'Código de persona requerido' });
    }

    const personaQuery  = `SELECT usuario_pg
                                , cod_empresa 
                             FROM personas 
                            WHERE cod_persona = $1`;
    const personaResult = await executeQueryWithSession(user, personaQuery, [cod_persona]);

    if (!personaResult.success || personaResult.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    }

    const usuario_pg  = personaResult.data[0].usuario_pg;
    const cod_empresa = personaResult.data[0].cod_empresa;

    if (usuario_pg) {
      const activeSessionsQuery = `SELECT COUNT(*) as count 
                                     FROM pg_stat_activity 
                                    WHERE usename = $1`;
      const sessionsResult = await executeAdminQuery(adminUser, activeSessionsQuery, [usuario_pg]);
      
      if (sessionsResult.data[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar la persona porque tiene sesiones activas. Cierre las sesiones primero.'
        });
      }
    }

    // Eliminar persona
    const deleteQuery = `DELETE 
                           FROM personas 
                          WHERE cod_persona = $1`;
    const result = await executeQueryWithSession(user, deleteQuery, [cod_persona]);

    if (!result.success) {
      throw new Error('Error al eliminar persona');
    }

    // Eliminar menús especiales del usuario (con cod_empresa)
    if (usuario_pg) {
      try {
        await executeQueryWithSession(user, 
          `DELETE FROM roles_menu_espec 
            WHERE cod_empresa = $1 
              AND usuario_pg = $2`, 
          [cod_empresa, usuario_pg]
        );
      } catch (menuError) {
        log_error.error(`Error eliminando menús del usuario ${usuario_pg}:`, menuError);
      }
    }

    // Eliminar usuario de PostgreSQL
    if (usuario_pg) {
      try {
        const revokeRolesQuery = `
          SELECT r.rolname 
            FROM pg_user u
            JOIN pg_auth_members m 
              ON u.usesysid = m.member
            JOIN pg_roles r 
              ON m.roleid = r.oid
           WHERE u.usename = $1
        `;
        const rolesResult = await executeAdminQuery(adminUser, revokeRolesQuery, [usuario_pg]);
        
        if (rolesResult.data && rolesResult.data.length > 0) {
          for (const roleRow of rolesResult.data) {
            await executeAdminQuery(adminUser, `REVOKE ${roleRow.rolname} FROM ${usuario_pg}`, []);
          }
        }

        await executeAdminQuery(adminUser, `DROP USER IF EXISTS ${usuario_pg}`, []);
      } catch (pgError) {
        log_error.error(`Error eliminando usuario PostgreSQL ${usuario_pg}:`, pgError);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Persona eliminada exitosamente'
    });

  } catch (error) {
    log_error.error('Error eliminando persona:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar persona', error: error.message });
  }
};