// src/scripts/test-limits.js
const http = require('http');

const PORT = 4000;
const LOGIN_URL = `http://localhost:${PORT}/public/login`;

async function testLogin(username) {
    const data = JSON.stringify({ username, password: 'wrong_password', nro_documento: '123' });

    return new Promise((resolve) => {
        const req = http.request(LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
        });

        req.on('error', (e) => resolve({ error: e.message }));
        req.write(data);
        req.end();
    });
}

async function runTest() {
    console.log('--- Probando Límite de Login (5 intentos) ---');
    for (let i = 1; i <= 6; i++) {
        const result = await testLogin('testuser');
        console.log(`Intento ${i}: Status ${result.status}`, result.body.message);
        if (result.status === 429) {
            console.log('✅ BLOQUEADO EXITOSAMENTE');
            break;
        }
    }
}

runTest();
