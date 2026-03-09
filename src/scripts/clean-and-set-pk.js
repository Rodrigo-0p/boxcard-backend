const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: 'superadm',
    password: 'prueba'
});

async function cleanAndSetPK() {
    const client = await pool.connect();

    try {
        console.log('\n========================================');
        console.log('LIMPIANDO ÍNDICES Y CONFIGURANDO PK');
        console.log('========================================\n');

        // PASO 1: Listar todos los constraints actuales
        console.log('1. Constraints actuales:');
        const constraints = await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'personas'::regclass
    `);
        constraints.rows.forEach(row => {
            console.log(`   - ${row.conname} (${row.contype})`);
        });
        console.log('');

        // PASO 2: Eliminar PRIMARY KEY actual
        console.log('2. Eliminando PRIMARY KEY actual...');
        await client.query(`ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_pkey CASCADE`);
        console.log('   ✅ Eliminado\n');

        // PASO 3: Eliminar UNIQUE constraints
        console.log('3. Eliminando UNIQUE constraints...');
        await client.query(`ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_cod_persona_unique`);
        await client.query(`ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_empresa_documento_unique`);
        console.log('   ✅ Eliminados\n');

        // PASO 4: Eliminar índices
        console.log('4. Eliminando índices...');
        await client.query(`DROP INDEX IF EXISTS personas_empresa_usuario_idx`);
        console.log('   ✅ Eliminados\n');

        // PASO 5: Crear PRIMARY KEY compuesta con 3 columnas
        console.log('5. Creando PRIMARY KEY (cod_empresa, usuario_pg, cod_persona)...');
        await client.query(`
      ALTER TABLE personas 
      ADD CONSTRAINT personas_pkey 
      PRIMARY KEY (cod_empresa, usuario_pg, cod_persona)
    `);
        console.log('   ✅ PRIMARY KEY creada\n');

        // VERIFICAR RESULTADO
        console.log('========================================');
        console.log('RESULTADO FINAL');
        console.log('========================================\n');

        const finalConstraints = await client.query(`
      SELECT 
        conname,
        CASE contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'c' THEN 'CHECK'
        END as tipo,
        pg_get_constraintdef(oid) as definicion
      FROM pg_constraint
      WHERE conrelid = 'personas'::regclass
      ORDER BY contype
    `);

        console.log('Constraints:');
        finalConstraints.rows.forEach(row => {
            console.log(`  ✓ ${row.tipo}: ${row.conname}`);
            if (row.tipo === 'PRIMARY KEY') {
                console.log(`    ${row.definicion}`);
            }
        });

        console.log('\nÍndices:');
        const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'personas'
      ORDER BY indexname
    `);
        indexes.rows.forEach(row => {
            console.log(`  ✓ ${row.indexname}`);
        });

        console.log('\n✅ CONFIGURACIÓN COMPLETADA\n');
        console.log('PRIMARY KEY: (cod_empresa, usuario_pg, cod_persona)\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

cleanAndSetPK();
