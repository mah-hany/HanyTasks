"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.uploadAvatar = void 0;
const user_service_1 = require("./user.service");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'avatars');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
exports.uploadAvatar = (0, multer_1.default)({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
exports.userController = {
    async getAll(req, res, next) {
        try {
            const { departmentId, roleId, isActive, search } = req.query;
            const data = await user_service_1.userService.getAll({
                departmentId: departmentId ? +departmentId : undefined,
                roleId: roleId ? +roleId : undefined,
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
                search: search,
            });
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async getById(req, res, next) {
        try {
            const data = await user_service_1.userService.getById(+req.params.id);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async create(req, res, next) {
        try {
            const data = await user_service_1.userService.create(req.body);
            res.status(201).json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async update(req, res, next) {
        try {
            const data = await user_service_1.userService.update(+req.params.id, req.body);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async resetPassword(req, res, next) {
        try {
            const { newPassword } = req.body;
            const data = await user_service_1.userService.resetPassword(+req.params.id, newPassword);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async transfer(req, res, next) {
        try {
            const { toDeptId, note } = req.body;
            const data = await user_service_1.userService.transfer(+req.params.id, toDeptId, note, req.user.id);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async getOrgTree(_req, res, next) {
        try {
            const data = await user_service_1.userService.getOrgTree();
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
    async uploadPhoto(req, res, next) {
        try {
            if (!req.file)
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            const photoUrl = `/uploads/avatars/${req.file.filename}`;
            await user_service_1.userService.update(+req.params.id, { profilePhoto: photoUrl });
            res.json({ success: true, data: { photoUrl } });
        }
        catch (e) {
            next(e);
        }
    },
    async delete(req, res, next) {
        try {
            const data = await user_service_1.userService.delete(+req.params.id);
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    },
};
//# sourceMappingURL=user.controller.js.map