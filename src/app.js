
// src/app.js
const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const path           = require('path');
const {log_info}     = require('./log/logger');
const routes         = require('./routes/index');
const authMiddleware = require('./middleware/middleware');
const moment         = require('moment');

require('dotenv').config({path: path.join(__dirname, '..', '.env'), quiet: true});

const app = express();
app.set('trust proxy', true);

// ========================================
// MIDDLEWARES BÁSICOS
// ========================================
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin         : "*",
  methods        : ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders : ["Origin", "Accept", "Content-Type", "Authorization", "x-access-token"],
  credentials    : true
}));

// ========================================
// MIDDLEWARE PERSONALIZADO PARA IP
// ========================================
app.use((req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'same-site');
  req.clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  log_info.info (`ruta: ${req.path} - ${req.clientIP} - [${moment().format('DD-MM-YYYY HH:mm')}]`);
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
module.exports = app;