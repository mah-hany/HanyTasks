"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', auth_controller_1.authController.login);
router.post('/refresh', auth_controller_1.authController.refresh);
router.post('/forgot-password', auth_controller_1.authController.forgotPassword);
router.post('/reset-password', auth_controller_1.authController.resetPassword);
router.post('/logout', auth_1.authenticate, auth_controller_1.authController.logout);
router.post('/change-password', auth_1.authenticate, auth_controller_1.authController.changePassword);
router.get('/profile', auth_1.authenticate, auth_controller_1.authController.getProfile);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map