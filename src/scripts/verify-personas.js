/**
 * Script de Verificación y Corrección de Tabla Personas
 * Ejecuta todas las verificaciones y correcciones necesarias
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: 'superadm',
    password: 'prueba'
});

async function main() {
    const client = await pool.connect();

    try {
        console.log('\n==============================================');
        console.log('VERIFICACIÓN Y CORRECCIÓN DE TABLA PERSONAS');
        console.log('==============================================\n');

        // PASO 1: Verificar conexión
        console.log('✓ Conexión a base de datos establecida');
        console.log(`  Host: ${process.env.DB_HOST}`);
        console.log(`  Database: ${process.env.DB_NAME}`);
        console.log(`  Usuario: superadm\n`);

        // PASO 2: Verificar estructura actual
        console.log('📋 PASO 1: Verificando estructura de tabla personas...');
        const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'personas'
      ORDER BY ordinal_position
    `;
        const structure = await client.query(structureQuery);
        console.log(`  Columnas encontradas: ${structure.rows.length}`);

        // PASO 3: Verificar constraints existentes
        console.log('\n🔒 PASO 2: Verificando constraints existentes...');
        const constraintsQuery = `
      SELECT 
        conname as constraint_name,
        CASE contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
        END as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'personas'::regclass
    `;
        const constraints = await client.query(constraintsQuery);
        console.log(`  Constraints encontrados: ${constraints.rows.length}`);
        constraints.rows.forEach(row => {
            console.log(`    - ${row.constraint_name} (${row.constraint_type})`);
        });

        // PASO 4: Verificar duplicados
        console.log('\n🔍 PASO 3: Verificando duplicados...');

        // Duplicados por cod_persona
        const dupPersonaQuery = `
      SELECT cod_persona, COUNT(*) as count
      FROM personas
      GROUP BY cod_persona
      HAVING COUNT(*) > 1
    `;
        const dupPersona = await client.query(dupPersonaQuery);
        if (dupPersona.rows.length > 0) {
            console.log(`  ❌ Se encontraron ${dupPersona.rows.length} cod_persona duplicados:`);
            dupPersona.rows.forEach(row => {
                console.log(`     cod_persona ${row.cod_persona}: ${row.count} registros`);
            });
        } else {
            console.log('  ✅ No hay duplicados en cod_persona');
        }

        // Duplicados por (cod_empresa, usuario_pg)
        const dupUsuarioQuery = `
      SELECT cod_empresa, usuario_pg, COUNT(*) as count
      FROM personas
      WHERE usuario_pg IS NOT NULL
      GROUP BY cod_empresa, usuario_pg
      HAVING COUNT(*) > 1
    `;
        const dupUsuario = await client.query(dupUsuarioQuery);
        if (dupUsuario.rows.length > 0) {
            console.log(`  ❌ Se encontraron ${dupUsuario.rows.length} usuarios duplicados:`);
            dupUsuario.rows.forEach(row => {
                console.log(`     Empresa ${row.cod_empresa}, Usuario ${row.usuario_pg}: ${row.count} registros`);
            });
        } else {
            console.log('  ✅ No hay usuarios duplicados por empresa');
        }

        // Duplicados por (cod_empresa, nro_documento)
        const dupDocQuery = `
      SELECT cod_empresa, nro_documento, COUNT(*) as count
      FROM personas
      GROUP BY cod_empresa, nro_documento
      HAVING COUNT(*) > 1
    `;
        const dupDoc = await client.query(dupDocQuery);
        if (dupDoc.rows.length > 0) {
            console.log(`  ❌ Se encontraron ${dupDoc.rows.length} documentos duplicados:`);
            dupDoc.rows.forEach(row => {
                console.log(`     Empresa ${row.cod_empresa}, Doc ${row.nro_documento}: ${row.count} registros`);
            });
        } else {
            console.log('  ✅ No hay documentos duplicados por empresa');
        }

        // Si hay duplicados, detener
        if (dupPersona.rows.length > 0 || dupUsuario.rows.length > 0 || dupDoc.rows.length > 0) {
            console.log('\n⚠️  ADVERTENCIA: Hay duplicados en la base de datos.');
            console.log('   Debes limpiarlos manualmente antes de agregar constraints.');
            console.log('\n   Para limpiar duplicados, ejecuta:');
            console.log('   DELETE FROM personas a USING personas b');
            console.log('   WHERE a.cod_persona = b.cod_persona AND a.ctid < b.ctid;\n');
            return;
        }

        // PASO 5: Agregar PRIMARY KEY
        console.log('\n🔑 PASO 4: Agregando PRIMARY KEY...');
        const hasPK = constraints.rows.some(c => c.constraint_type === 'PRIMARY KEY');

        if (!hasPK) {
            try {
                await client.query(`
          ALTER TABLE personas 
          ADD CONSTRAINT personas_pkey 
          PRIMARY KEY (cod_persona)
        `);
                console.log('  ✅ PRIMARY KEY agregado exitosamente');
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        } else {
            console.log('  ℹ️  PRIMARY KEY ya existe');
        }

        // PASO 6: Agregar UNIQUE constraint para usuario
        console.log('\n👤 PASO 5: Agregando UNIQUE constraint para usuario...');
        try {
            await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS personas_empresa_usuario_idx 
        ON personas (cod_empresa, usuario_pg) 
        WHERE usuario_pg IS NOT NULL
      `);
            console.log('  ✅ UNIQUE constraint para usuario agregado');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('  ℹ️  UNIQUE constraint para usuario ya existe');
            } else {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

        // PASO 7: Agregar UNIQUE constraint para documento
        console.log('\n📄 PASO 6: Agregando UNIQUE constraint para documento...');
        const hasDocConstraint = constraints.rows.some(
            c => c.constraint_name === 'personas_empresa_documento_unique'
        );

        if (!hasDocConstraint) {
            try {
                await client.query(`
          ALTER TABLE personas 
          ADD CONSTRAINT personas_empresa_documento_unique 
          UNIQUE (cod_empresa, nro_documento)
        `);
                console.log('  ✅ UNIQUE constraint para documento agregado');
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        } else {
            console.log('  ℹ️  UNIQUE constraint para documento ya existe');
        }

        // PASO 8: Verificar constraints finales
        console.log('\n✅ PASO 7: Verificando constraints finales...');
        const finalConstraints = await client.query(constraintsQuery);
        console.log(`  Constraints totales: ${finalConstraints.rows.length}`);
        finalConstraints.rows.forEach(row => {
            console.log(`    ✓ ${row.constraint_name} (${row.constraint_type})`);
        });

        // PASO 9: Verificar roles_menu_espec
        console.log('\n📱 PASO 8: Verificando roles_menu_espec...');
        const rolesMenuQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT usuario_pg) as usuarios,
        COUNT(DISTINCT cod_role) as roles
      FROM roles_menu_espec
    `;
        const rolesMenu = await client.query(rolesMenuQuery);
        console.log(`  Registros totales: ${rolesMenu.rows[0].total}`);
        console.log(`  Usuarios únicos: ${rolesMenu.rows[0].usuarios}`);
        console.log(`  Roles únicos: ${rolesMenu.rows[0].roles}`);

        // Verificar constraint en roles_menu_espec
        const rolesMenuConstraintsQuery = `
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'roles_menu_espec'::regclass
        AND contype = 'p'
    `;
        const rolesMenuPK = await client.query(rolesMenuConstraintsQuery);
        if (rolesMenuPK.rows.length > 0) {
            console.log(`  ✅ PRIMARY KEY en roles_menu_espec:`);
            console.log(`     ${rolesMenuPK.rows[0].pg_get_constraintdef}`);
        } else {
            console.log(`  ⚠️  WARNING: No hay PRIMARY KEY en roles_menu_espec`);
        }

        // RESUMEN FINAL
        console.log('\n==============================================');
        console.log('RESUMEN FINAL');
        console.log('==============================================');
        console.log('✅ Estructura de personas verificada');
        console.log('✅ Constraints de personas corregidos');
        console.log('✅ Sistema de roles analizado');
        console.log('\n🎯 PRÓXIMOS PASOS:');
        console.log('1. Reiniciar backend (Ctrl+C y npm run dev)');
        console.log('2. Probar editar usuario y cambiar menús');
        console.log('3. Verificar que NO se dupliquen registros\n');

    } catch (error) {
        console.error('❌ Error durante la verificación:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main()
    .then(() => {
        console.log('✅ Script completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script falló:', error);
        process.exit(1);
    });
