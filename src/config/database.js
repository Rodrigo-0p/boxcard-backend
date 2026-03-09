const { Client } = require('pg');
const path = require('path');
const { log_error } = require('../log/logger')
const main = require('../utils/main');
const moment = require('moment');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

// ========================================
// FUNCIÓN PARA CONSULTAS CON SESIÓN
// ========================================
const executeQueryWithSession = async (user, sqlQuery, params = []) => {
  const sessionData = user;
  // Reutilizar tu función existente
  return await executeWithUserConnection(
    sessionData.username,
    sessionData.password,
    async (client) => {
      const result = await client.query(sqlQuery, params);
      return result.rows;
    }
  );
};

const executeAdminQuery = async (adminUser, sqlQuery, params = []) => {
  return await executeWithUserConnection(
    adminUser.username,
    adminUser.password,
    async (client) => {
      const result = await client.query(sqlQuery, params);
      return result.rows;
    }
  );
};

// ========================================
// ESQUEMA GENÉRICO: CONECTAR → CONSULTAR → CERRAR
// ========================================
const executeWithUserConnection = async (username, password, queryCallback) => {
  // console.log({
  //   user      : username,
  //   host      : process.env.DB_HOST || 'localhost',
  //   database  : process.env.DB_NAME || 'boxcard',
  //   password  : password,
  //   port      : process.env.DB_PORT || 5432,
  //   connectionTimeoutMillis: 5000,
  // })
  const client = new Client({
    user: username,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'boxcard',
    password: password,
    port: process.env.DB_PORT || 5432,
    connectionTimeoutMillis: 5000,
  });

  try {
    // 1. CONECTAR con usuario específico
    await client.connect();
    // 2. EJECUTAR consulta/callback
    const result = await queryCallback(client);
    // 3. CERRAR conexión
    await client.end();
    return { success: true, data: result };
  } catch (error) {
    try {
      await client.end();
    } catch (closeError) {
      // Ignorar errores al cerrar
    }
    console.error(`Error con usuario ${username}:`, error);
    log_error.error(moment().format('DD/MM/YYYY HH:mm:ss') + ` Error con usuario ${username}:`, error);

    // Clasificar errores
    if (error.code === '28P01') {
      let verror1 = { success: false, message: 'Usuario o contraseña incorrectos' }
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror1)
      return verror1;

    } else if (error.code === 'ECONNREFUSED') {
      let verror2 = { success: false, message: 'Usuario o contraseña incorrectos' }
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror2)
      return { success: false, message: 'Error de conexión a la base de datos' };

    } else if (error.code === '3D000') {
      let verror3 = { success: false, message: 'Base de datos no encontrada' };
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror3)
      return verror3;

    }
    let verror4 = { success: false, message: 'Error de autenticación' };
    log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror4)
    return verror4;
  }
};

// ========================================
// FUNCIÓN ESPECÍFICA PARA LOGIN
// ========================================
const authenticateAndGetUserData = async (username, password, nro_documento_login) => {
  return await executeWithUserConnection(username, password, async (client) => {

    if (!nro_documento_login) {
      const verror = 'Número de documento no proporcionado';
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror);
      return { success: false, message: verror }
    }

    // 1. OBTENER DATOS BÁSICOS DEL USUARIO Y SU ROL
    const userQuery = `
      SELECT p.cod_persona
           , p.usuario_pg
           , p.descripcion
           , p.estado
           , p.password_temporal
           , p.cod_empresa
           , ( SELECT r.rolname 
                 FROM pg_roles r
                INNER JOIN pg_auth_members m ON r.oid = m.roleid
                INNER JOIN pg_roles u ON u.oid = m.member
                WHERE u.rolname = CURRENT_USER
                LIMIT 1 
            ) as role
      FROM personas p 
      WHERE p.usuario_pg = CURRENT_USER 
        AND p.estado     = 'A'`;

    const userResult = await client.query(userQuery);

    if (userResult.rows.length === 0) {
      const verror = 'Usuario no encontrado o inactivo';
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror);
      return { success: false, message: verror }
    }

    const userData = userResult.rows[0];

    // 2. OBTENER TODAS LAS EMPRESAS ACTIVAS DEL USUARIO
    const empresasQuery = `
     SELECT e.nombre as empresa
          , e.ruc
          , e.tip_empresa
          , e.modalidad
          , e.cod_empresa
          , e.logo_url
       FROM empresas e
      INNER JOIN personas pe 
         ON e.cod_empresa  = pe.cod_empresa
      WHERE pe.cod_persona = $1
        AND e.estado  = 'A'
        AND pe.estado = 'A'
      ORDER BY e.nombre ASC`;

    const empresasResult = await client.query(empresasQuery, [userData.cod_persona]);


    if (empresasResult.rows.length === 0) {
      const verror = 'Usuario sin empresas activas asignadas';
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror);
      return { success: false, message: verror }
    }

    const empresas = empresasResult.rows;
    const vnro_documento = main.cleanDocumentNumber(main.nvl(nro_documento_login, ''));

    const empresaLogin = empresas.find(emp => {
      const cleanRuc = main.cleanDocumentNumber(emp.ruc);
      return cleanRuc === vnro_documento;
    });
    if (!empresaLogin) {
      const verror = 'El documento ingresado no coincide con ninguna empresa asociada';
      log_error.error(moment().format('DD/MM/YYYY HH:mm:ss'), verror);
      return { success: false, message: verror }
    }

    // 4. RETORNAR DATOS ORGANIZADOS
    return {
      cod_persona: userData.cod_persona,
      usuario_pg: userData.usuario_pg,
      descripcion: userData.descripcion,
      estado: userData.estado,
      password_temporal: userData.password_temporal,
      role: userData.role,
      empresa_login: empresaLogin,
      empresas_all: empresas,
    };
  });
};

module.exports = {
  executeWithUserConnection,
  authenticateAndGetUserData,
  executeQueryWithSession,
  executeAdminQuery
};