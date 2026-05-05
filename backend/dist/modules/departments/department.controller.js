"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentController = void 0;
const department_service_1 = require("./department.service");
exports.departmentController = {
    async getAll(_req, res, next) {
        try {
            res.json({ success: true, data: await department_service_1.departmentService.getAll() });
        }
        catch (e) {
            next(e);
        }
    },
    async getTree(_req, res, next) {
        try {
            res.json({ success: true, data: await department_service_1.departmentService.getTree() });
        }
        catch (e) {
            next(e);
        }
    },
    async create(req, res, next) {
        try {
            res.status(201).json({ success: true, data: await department_service_1.departmentService.create(req.body) });
        }
        catch (e) {
            next(e);
        }
    },
    async update(req, res, next) {
        try {
            res.json({ success: true, data: await department_service_1.departmentService.update(+req.params.id, req.body) });
        }
        catch (e) {
            next(e);
        }
    },
    async delete(req, res, next) {
        try {
            res.json({ success: true, data: await department_service_1.departmentService.delete(+req.params.id) });
        }
        catch (e) {
            next(e);
        }
    },
};
//# sourceMappingURL=department.controller.js.map