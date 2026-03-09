const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boxcard',
    user: process.env.DB_USER || 'superadm',
    password: process.env.DB_PASSWORD || 'prueba'
});

async function rebuildTable() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('--- Eliminando la tabla actual y sus dependencias (CASCADE) ---');
        await client.query('DROP TABLE IF EXISTS nominas_benef CASCADE;');

        console.log('--- Creando la nueva tabla nominas_benef ---');
        const createQuery = `
            CREATE TABLE nominas_benef (
                cod_beneficiario SERIAL PRIMARY KEY,
                cod_empresa INTEGER NOT NULL,
                cod_persona INTEGER,
                nro_documento VARCHAR(50) NOT NULL,
                ruc VARCHAR(50),
                nombre_completo VARCHAR(200) NOT NULL,
                correo VARCHAR(150),
                nro_telef VARCHAR(50),
                estado VARCHAR(1) DEFAULT 'A',
                
                -- Campos de Auditoria
                usuario_alta VARCHAR(100),
                fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                usuario_mod VARCHAR(100),
                fecha_mod TIMESTAMP
            );

            -- Indices recomendados para mejor rendimiento en búsquedas y validaciones
            CREATE INDEX idx_benef_empresa ON nominas_benef(cod_empresa);
            CREATE INDEX idx_benef_documento ON nominas_benef(nro_documento);
            CREATE INDEX idx_benef_estado ON nominas_benef(estado);
        `;
        await client.query(createQuery);

        await client.query('COMMIT');
        console.log('✅ La tabla nominas_benef se ha reconstruido con éxito, incluyendo la auditoría y RUC.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error al reconstruir la tabla:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

rebuildTable();
