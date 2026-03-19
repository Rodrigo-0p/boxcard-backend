
const express = require('express');
const router = express.Router();
// PUBLI
const auth = require('./public/auth.routes');
const info = require('./public/info.routes');
// BASE
const solicitud = require('./private/base/Solicitud.routes');
const solicitud_adm = require('./private/adm/Solicitud.routes');
const beneficiario = require('./private/base/Beneficiario.routes');
const beneficiario_adm = require('./private/adm/Beneficiario.routes');
const menu = require('./private/base/bs.routes');
const img = require('./private/img/img.empresa');
const empresas_base = require('./private/base/Empresa.routes');
// ADM
// EMPRESAS
const empresas = require('./private/adm/Empresas.routes');
// PERSONA
const persona = require('./private/adm/Persona.routes');
// USUARIO
const usuario = require('./private/adm/Usuario.routes');
// CONFIGURACIÓN / PERFIL
const profile = require('./private/conf/Profile.routes');

module.exports = () => {

  // PUBLIC
  router.use(auth());
  router.use(info());

  // PRIVADO BASE
  router.use(menu());
  router.use(img());
  router.use(empresas_base());

  // PRIVADO EMPRESAS
  router.use(empresas());
  router.use(persona());
  router.use(usuario());
  router.use(solicitud());
  router.use(solicitud_adm());
  router.use(beneficiario());
  router.use(beneficiario_adm());
  router.use(profile());

  return router;
}