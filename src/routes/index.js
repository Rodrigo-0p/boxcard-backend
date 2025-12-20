
const express  = require('express');
const router   = express.Router();
// PUBLI
const auth     = require('./public/auth.routes');
const info     = require('./public/info.routes');
// BASE
const menu     = require('./private/base/bs.routes');
const img      = require('./private/img/img.empresa');
// ADM
// EMPRESAS
const empresas = require('./private/adm/Empresas.routes');
// PERSONA
const persona  = require('./private/adm/Persona.routes');

module.exports = ()=>{
  
  // PUBLIC
  router.use( auth() );
  router.use( info() );

  // PRIVADO BASE
  router.use( menu() );
  router.use( img()  );

  // PRIVADO EMPRESAS
  router.use( empresas() );
  router.use( persona()  );

  return router;
}