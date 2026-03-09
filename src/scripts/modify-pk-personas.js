const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: 'superadm',
    password: 'prueba'
});

async function modifyPrimaryKey() {
    const client = await pool.connect();

    try {
        console.log('\n========================================');
        console.log('MODIFICANDO PRIMARY KEY DE PERSONAS');
        console.log('========================================\n');

        // PASO 1: Verificar si hay personas sin usuario_pg
        console.log('1. Verificando personas sin usuario_pg...');
        const checkNull = await client.query(`
      SELECT COUNT(*) as count
      FROM personas
      WHERE usuario_pg IS NULL
    `);

        const nullCount = parseInt(checkNull.rows[0].count);
        console.log(`   Personas sin usuario_pg: ${nullCount}\n`);

        if (nullCount > 0) {
            console.log('   ⚠️  ADVERTENCIA: Hay personas sin usuario_pg');
            console.log('   La PRIMARY KEY compuesta solo funcionará si todas tienen usuario_pg\n');
            console.log('   Recomendación: usar (cod_persona, cod_empresa) en lugar de (usuario_pg, cod_empresa)\n');
        }

        // PASO 2: Eliminar PRIMARY KEY actual
        console.log('2. Eliminando PRIMARY KEY actual...');
        try {
            await client.query(`
        ALTER TABLE personas 
        DROP CONSTRAINT IF EXISTS personas_pkey CASCADE
      `);
            console.log('   ✅ PRIMARY KEY eliminada\n');
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }

        // PASO 3: Agregar nueva PRIMARY KEY compuesta
        console.log('3. Agregando PRIMARY KEY (cod_empresa, usuario_pg)...');
        try {
            await client.query(`
        ALTER TABLE personas 
        ADD CONSTRAINT personas_pkey 
        PRIMARY KEY (cod_empresa, usuario_pg)
      `);
            console.log('   ✅ PRIMARY KEY compuesta agregada\n');
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            console.log('   Probablemente hay NULLs en usuario_pg\n');

            // Intentar alternativa: (cod_persona, cod_empresa)
            console.log('   Intentando alternativa: PRIMARY KEY (cod_persona, cod_empresa)...');
            try {
                await client.query(`
          ALTER TABLE personas 
          ADD CONSTRAINT personas_pkey 
          PRIMARY KEY (cod_persona, cod_empresa)
        `);
                console.log('   ✅ PRIMARY KEY alternativa agregada\n');
            } catch (altError) {
                console.log(`   ❌ Error alternativa: ${altError.message}\n`);
            }
        }

        // PASO 4: Asegurar UNIQUE en cod_persona si no es PK
        console.log('4. Agregando UNIQUE en cod_persona...');
        try {
            await client.query(`
        ALTER TABLE personas 
        ADD CONSTRAINT personas_cod_persona_unique 
        UNIQUE (cod_persona)
      `);
            console.log('   ✅ UNIQUE en cod_persona agregado\n');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('   ℹ️  UNIQUE en cod_persona ya existe\n');
            } else {
                console.log(`   ❌ Error: ${error.message}\n`);
            }
        }

        // VERIFICAR RESULTADO FINAL
        console.log('========================================');
        console.log('CONSTRAINTS FINALES');
        console.log('========================================\n');

        const result = await client.query(`
      SELECT 
        conname,
        CASE contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
        END as tipo,
        pg_get_constraintdef(oid) as definicion
      FROM pg_constraint
      WHERE conrelid = 'personas'::regclass
        AND contype IN ('p', 'u')
      ORDER BY contype, conname
    `);

        result.rows.forEach(row => {
            console.log(`✓ ${row.tipo}: ${row.conname}`);
            console.log(`  ${row.definicion}\n`);
        });

        console.log('✅ MODIFICACIÓN COMPLETADA\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

modifyPrimaryKey();
