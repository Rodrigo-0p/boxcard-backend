const { Pool }    = require('pg');
const path        = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '..', '.env'), quiet: true});

const poolInfoContacto = new Pool({
  host     : process.env.DB_HOST,
  port     : process.env.DB_PORT,
  database : process.env.DB_NAME,
  user     : process.env.DB_INFO_CONTACTO_USER,
  password : process.env.DB_INFO_CONTACTO_PASSWORD,
  max      : 5,
  idleTimeoutMillis: 30000
});

module.exports = poolInfoContacto;