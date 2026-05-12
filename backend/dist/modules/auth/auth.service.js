"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = __importDefault(require("../../prisma/client"));
const errorHandler_1 = require("../../middleware/errorHandler");
const email_service_1 = require("../email/email.service");
const MAX_FAILED = 3;
const LOCK_MINUTES = 5;
exports.authService = {
    async login(username, password, ip) {
        const user = await client_1.default.user.findFirst({
            where: { username },
            include: { role: true, department: true },
        });
        if (!user)
            throw new errorHandler_1.AppError('بيانات الدخول غير صحيحة / Invalid credentials', 401);
        if (!user.isActive)
            throw new errorHandler_1.AppError('الحساب موقوف / Account is deactivated', 403);
        // Check lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new errorHandler_1.AppError(`الحساب مقفل مؤقتاً. حاول بعد ${mins} دقيقة / Account locked for ${mins} minutes`, 429);
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            const failed = user.failedLoginCount + 1;
            const lockUntil = failed >= MAX_FAILED
                ? new Date(Date.now() + LOCK_MINUTES * 60000)
                : null;
            await client_1.default.user.update({
                where: { id: user.id },
                data: { failedLoginCount: failed, lockedUntil: lockUntil },
            });
            await client_1.default.auditLog.create({
                data: {
                    userId: user.id, action: 'LOGIN_FAILED',
                    ipAddress: ip, tableAffected: 'tbl_Users', recordId: user.id,
                },
            });
            if (failed >= MAX_FAILED) {
                throw new errorHandler_1.AppError('تم قفل الحساب بعد 3 محاولات خاطئة / Account locked after 3 failed attempts', 429);
            }
            throw new errorHandler_1.AppError(`بيانات غير صحيحة. محاولات متبقية: ${MAX_FAILED - failed} / Invalid credentials`, 401);
        }
        // Reset failed count
        await client_1.default.user.update({
            where: { id: user.id },
            data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await client_1.default.auditLog.create({
            data: {
                userId: user.id, action: 'LOGIN_SUCCESS',
                ipAddress: ip, tableAffected: 'tbl_Users', recordId: user.id,
            },
        });
        const JWT_SECRET = process.env.JWT_SECRET;
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
        if (!JWT_SECRET || !JWT_REFRESH_SECRET)
            throw new Error('JWT secrets not configured');
        const accessToken = jsonwebtoken_1.default.sign({ sub: user.id, username: user.username, role: user.role.name }, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') });
        const refreshToken = jsonwebtoken_1.default.sign({ sub: user.id }, JWT_REFRESH_SECRET, { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') });
        return {
            accessToken,
            refreshToken,
            isFirstLogin: user.isFirstLogin,
            user: {
                id: user.id,
                employeeCode: user.employeeCode,
                fullName: user.fullName,
                fullNameAr: user.fullNameAr,
                username: user.username,
                email: user.email,
                profilePhoto: user.profilePhoto,
                preferredLang: user.preferredLang,
                role: { id: user.role.id, name: user.role.name, nameAr: user.role.nameAr, level: user.role.level },
                department: user.department ? { id: user.department.id, name: user.department.name, nameAr: user.department.nameAr } : null,
            },
        };
    },
    async refresh(refreshToken) {
        try {
            const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
            if (!JWT_REFRESH_SECRET)
                throw new Error('JWT_REFRESH_SECRET not configured');
            const payload = jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET);
            const user = await client_1.default.user.findUnique({
                where: { id: payload.sub },
                include: { role: true },
            });
            if (!user || !user.isActive)
                throw new errorHandler_1.AppError('Invalid refresh token', 401);
            const accessToken = jsonwebtoken_1.default.sign({ sub: user.id, username: user.username, role: user.role.name }, process.env.JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') });
            return { accessToken };
        }
        catch {
            throw new errorHandler_1.AppError('Invalid or expired refresh token', 401);
        }
    },
    async changePassword(userId, oldPassword, newPassword) {
        const user = await client_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        const valid = await bcryptjs_1.default.compare(oldPassword, user.passwordHash);
        if (!valid)
            throw new errorHandler_1.AppError('كلمة المرور الحالية غير صحيحة / Current password incorrect', 400);
        const hash = await bcryptjs_1.default.hash(newPassword, 12);
        await client_1.default.user.update({
            where: { id: userId },
            data: { passwordHash: hash, plainPassword: newPassword, isFirstLogin: false },
        });
        await client_1.default.auditLog.create({
            data: { userId, action: 'PASSWORD_CHANGED', tableAffected: 'tbl_Users', recordId: userId },
        });
        return { message: 'Password changed successfully' };
    },
    async forgotPassword(email) {
        const user = await client_1.default.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
            // Return success even if not found to prevent email enumeration
            return { message: 'If the email exists, a reset code has been sent' };
        }
        // Generate 6-digit token
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await client_1.default.user.update({
            where: { id: user.id },
            data: { resetToken: token, resetTokenExpiry: expiry },
        });
        await (0, email_service_1.sendEmail)({
            to: email,
            subject: 'إعادة تعيين كلمة المرور - Hany Tasks',
            html: (0, email_service_1.forgotPasswordEmail)(user.fullNameAr || user.fullName, token),
        });
        return { message: 'If the email exists, a reset code has been sent' };
    },
    async resetPasswordWithToken(token, newPassword) {
        const user = await client_1.default.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('الكود غير صحيح أو منتهي الصلاحية / Invalid or expired code', 400);
        }
        const hash = await bcryptjs_1.default.hash(newPassword, 12);
        await client_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hash,
                plainPassword: newPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });
        return { message: 'Password reset successfully' };
    },
    async getProfile(userId) {
        const user = await client_1.default.user.findUnique({
            where: { id: userId },
            include: {
                role: true,
                department: true,
                manager: { select: { id: true, fullName: true, fullNameAr: true, employeeCode: true } },
            },
        });
        if (!user)
            throw new errorHandler_1.AppError('User not found', 404);
        const { passwordHash, ...safe } = user;
        return safe;
    },
};
//# sourceMappingURL=auth.service.js.map