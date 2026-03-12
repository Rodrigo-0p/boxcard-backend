const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
    user: process.env.DB_USER_UPDATE,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS_UPDATE,
    port: process.env.DB_PORT,
});

async function main() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'nominas_benef'
            ORDER BY column_name
        `);
        console.log('--- COLUMNS IN nominas_benef ---');
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}
main();
