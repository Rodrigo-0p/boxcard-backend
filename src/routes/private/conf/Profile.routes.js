const express = require('express');
const router = express.Router();
const changePassword = require('../../../controllers/private/conf/ChangePassword.controller');
const updateProfile = require('../../../controllers/private/conf/UpdateProfile.controller');
const { strictLimiter } = require('../../../middleware/rateLimiters');

const base_ruta = '/conf/profile';

module.exports = () => {
    router.post(`${base_ruta}/change-password`, strictLimiter, changePassword.main);
    router.post(`${base_ruta}/update-details`, strictLimiter, updateProfile.main);

    return router;
};
