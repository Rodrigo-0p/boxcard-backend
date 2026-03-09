const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: 'superadm',
    password: 'prueba'
});

async function addConstraints() {
    const client = await pool.connect();

    try {
        console.log('\n========================================');
        console.log('AGREGANDO CONSTRAINTS A TABLA PERSONAS');
        console.log('========================================\n');

        // PASO 1: Agregar PRIMARY KEY
        console.log('1. Agregando PRIMARY KEY...');
        try {
            await client.query(`
        ALTER TABLE personas 
        ADD CONSTRAINT personas_pkey 
        PRIMARY KEY (cod_persona)
      `);
            console.log('   ✅ PRIMARY KEY agregado\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('   ℹ️  PRIMARY KEY ya existe\n');
            } else {
                console.log(`   ❌ Error: ${error.message}\n`);
            }
        }

        // PASO 2: UNIQUE para usuario
        console.log('2. Agregando UNIQUE para usuario...');
        try {
            await client.query(`DROP INDEX IF EXISTS personas_empresa_usuario_idx`);
            await client.query(`
        CREATE UNIQUE INDEX personas_empresa_usuario_idx 
        ON personas (cod_empresa, usuario_pg) 
        WHERE usuario_pg IS NOT NULL
      `);
            console.log('   ✅ UNIQUE INDEX para usuario agregado\n');
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }

        // PASO 3: UNIQUE para documento
        console.log('3. Agregando UNIQUE para documento...');
        try {
            await client.query(`
        ALTER TABLE personas 
        DROP CONSTRAINT IF EXISTS personas_empresa_documento_unique
      `);
            await client.query(`
        ALTER TABLE personas 
        ADD CONSTRAINT personas_empresa_documento_unique 
        UNIQUE (cod_empresa, nro_documento)
      `);
            console.log('   ✅ UNIQUE para documento agregado\n');
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }

        // VERIFICAR RESULTADO
        console.log('========================================');
        console.log('VERIFICANDO CONSTRAINTS FINALES');
        console.log('========================================\n');

        const result = await client.query(`
      SELECT 
        conname,
        CASE contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
        END as tipo
      FROM pg_constraint
      WHERE conrelid = 'personas'::regclass
      ORDER BY contype
    `);

        result.rows.forEach(row => {
            console.log(`✓ ${row.tipo}: ${row.conname}`);
        });

        // Verificar índices
        const idxResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'personas'
        AND indexname LIKE '%persona%'
    `);

        console.log('\nÍndices:');
        idxResult.rows.forEach(row => {
            console.log(`✓ ${row.indexname}`);
        });

        console.log('\n✅ CONSTRAINTS AGREGADOS EXITOSAMENTE\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

addConstraints();
