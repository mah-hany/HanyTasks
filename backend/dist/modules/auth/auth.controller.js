"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const auth_service_1 = require("./auth.service");
const zod_1 = require("zod");
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(2),
    password: zod_1.z.string().min(4),
});
const changePassSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(4),
    newPassword: zod_1.z.string().min(8),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(6),
    newPassword: zod_1.z.string().min(8),
});
exports.authController = {
    async login(req, res, next) {
        try {
            const { username, password } = loginSchema.parse(req.body);
            const ip = req.ip || req.headers['x-forwarded-for'];
            const result = await auth_service_1.authService.login(username, password, ip);
            res.json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    },
    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ success: false, message: 'No refresh token' });
            }
            const result = await auth_service_1.authService.refresh(refreshToken);
            res.json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    },
    async changePassword(req, res, next) {
        try {
            const { oldPassword, newPassword } = changePassSchema.parse(req.body);
            const result = await auth_service_1.authService.changePassword(req.user.id, oldPassword, newPassword);
            res.json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    },
    async getProfile(req, res, next) {
        try {
            const result = await auth_service_1.authService.getProfile(req.user.id);
            res.json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    },
    async logout(req, res) {
        // Stateless JWT — client discards token
        res.json({ success: true, message: 'Logged out successfully' });
    },
    async forgotPassword(req, res, next) {
        try {
            const { email } = forgotPasswordSchema.parse(req.body);
            const result = await auth_service_1.authService.forgotPassword(email);
            res.json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    },
    async resetPassword(req, res, next) {
        try {
            const { token, newPassword } = resetPasswordSchema.parse(req.body);
            const result = await auth_service_1.authService.resetPasswordWithToken(token, newPassword);
            res.json({ success: true, data: result });
        }
        catch (e) {
            next(e);
        }
    },
};
//# sourceMappingURL=auth.controller.js.map