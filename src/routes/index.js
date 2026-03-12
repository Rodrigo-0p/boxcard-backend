
const express = require('express');
const router = express.Router();
// PUBLI
const auth = require('./public/auth.routes');
const info = require('./public/info.routes');
// BASE
const menu = require('./private/base/bs.routes');
const img = require('./private/img/img.empresa');
// ADM
// EMPRESAS
const empresas = require('./private/adm/Empresas.routes');
// PERSONA
const persona = require('./private/adm/Persona.routes');
// USUARIO
const usuario = require('./private/adm/Usuario.routes');
// SOLICITUD
const solicitud = require('./private/adm/Solicitud.routes');
// BENEFICIARIO
const beneficiario = require('./private/adm/Beneficiario.routes');
// CONFIGURACIÓN / PERFIL
const profile = require('./private/conf/Profile.routes');

module.exports = () => {

  // PUBLIC
  router.use(auth());
  router.use(info());

  // PRIVADO BASE
  router.use(menu());
  router.use(img());

  // PRIVADO EMPRESAS
  router.use(empresas());
  router.use(persona());
  router.use(usuario());
  router.use(solicitud());
  router.use(beneficiario());
  router.use(profile());

  return router;
}