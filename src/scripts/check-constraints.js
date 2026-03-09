const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: 'superadm',
    password: 'prueba'
});

async function checkConstraints() {
    const client = await pool.connect();

    try {
        console.log('\n=== VERIFICANDO CONSTRAINTS EN PERSONAS ===\n');

        const query = `
      SELECT 
        conname as nombre,
        CASE contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
        END as tipo,
        pg_get_constraintdef(oid) as definicion
      FROM pg_constraint
      WHERE conrelid = 'personas'::regclass
      ORDER BY contype;
    `;

        const result = await client.query(query);

        if (result.rows.length === 0) {
            console.log('❌ NO hay constraints en la tabla personas\n');
        } else {
            console.log(`✅ Se encontraron ${result.rows.length} constraints:\n`);
            result.rows.forEach(row => {
                console.log(`  ${row.tipo}: ${row.nombre}`);
                console.log(`  → ${row.definicion}\n`);
            });
        }

        // Verificar índices
        console.log('=== VERIFICANDO ÍNDICES ===\n');
        const idxQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'personas'
      ORDER BY indexname;
    `;

        const idxResult = await client.query(idxQuery);
        console.log(`Se encontraron ${idxResult.rows.length} índices:\n`);
        idxResult.rows.forEach(row => {
            console.log(`  ${row.indexname}`);
            console.log(`  → ${row.indexdef}\n`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkConstraints();
