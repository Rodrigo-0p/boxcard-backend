const { Pool } = require('pg');
require('dotenv').config();

// Assuming .env is in the parent directory or current
const pool = new Pool({
  user: process.env.DB_USER_UPDATE,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS_UPDATE,
  port: process.env.DB_PORT,
});

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'roles_menus'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
