// src/scripts/reset-limits.js
const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const URL = `http://localhost:${PORT}/internal/reset-limits`;

console.log('--- Iniciando reseteo de Rate Limits ---');
console.log(`Conectando a: ${URL}...`);

http.get(URL, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            if (response.success) {
                console.log('\n========================================');
                console.log('✅ ÉXITO: Todos los contadores han sido reseteados.');
                console.log('========================================\n');
            } else {
                console.error('❌ ERROR del servidor:', response.message);
            }
        } catch (e) {
            console.error('❌ ERROR al procesar respuesta:', data);
        }
    });
}).on('error', (err) => {
    console.error('\n❌ ERROR: No se pudo conectar con el servidor.');
    console.error('Asegúrate de que el backend esté corriendo en el puerto', PORT);
    console.log('Detalle:', err.message);
});
