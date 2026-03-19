
// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { log_info, log_error } = require('./log/logger');
const routes = require('./routes/index');
const authMiddleware = require('./middleware/middleware');
const moment = require('moment');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const app = express();
app.set('trust proxy', true);

// ========================================
// MIDDLEWARES BÁSICOS
// ========================================
app.use(express.json());
app.use('/empresas', express.static(path.join(process.cwd(), 'src', 'filestore', 'empresas')));
app.use('/comprobantes', express.static(path.join(process.cwd(), 'src', 'filestore', 'comprobantes')));
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "Accept", "Content-Type", "Authorization", "x-access-token"],
  credentials: true
}));

// ========================================
// MIDDLEWARE PERSONALIZADO PARA IP
// ========================================
app.use((req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'same-site');
  req.clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  console.log(`[API REQUEST] ${req.method} ${req.originalUrl} - IP: ${req.clientIP}`);
  log_info.info(`Ruta: ${req.originalUrl} - Método: ${req.method} - IP: ${req.clientIP} - [${moment().format('DD-MM-YYYY HH:mm')}]`);
  next();
});

// ========================================
// MIDDLEWARE DE DECISIÓN DE AUTENTICACIÓN
// Este middleware decide qué rutas necesitan token y cuáles no
// ========================================
app.use(authMiddleware.authDecisionMiddleware);

// ========================================
// RUTAS PRINCIPALES
// ========================================
app.use('/', routes());

// ========================================
// MANEJO GLOBAL DE ERRORES
// ========================================
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Error interno del servidor';
  
  log_error.error(`[GLOBAL_ERROR] ${statusCode} - ${message} - Ruta: ${req.path} - Método: ${req.method} - IP: ${req.clientIP} - Stack: ${err.stack}`);
  
  res.status(statusCode).json({
    success: false,
    mensaje: message,
    code: err.code || 'INTERNAL_ERROR'
  });
});

module.exports = app;