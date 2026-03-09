const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: process.env.DB_USER || 'superadm',
    password: process.env.DB_PASSWORD || 'prueba'
});

async function describeTable() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'nominas_benef'
            ORDER BY ordinal_position;
        `;
        const res = await client.query(query);
        console.log("Columns in nominas_benef:");
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type}) nullable: ${r.is_nullable}`));
    } finally {
        client.release();
        await pool.end();
    }
}
describeTable();
