"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const department_controller_1 = require("./department.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/tree', department_controller_1.departmentController.getTree);
router.get('/', department_controller_1.departmentController.getAll);
router.post('/', (0, auth_1.authorizeLevel)(2), department_controller_1.departmentController.create);
router.put('/:id', (0, auth_1.authorizeLevel)(2), department_controller_1.departmentController.update);
router.delete('/:id', (0, auth_1.authorizeLevel)(1), department_controller_1.departmentController.delete);
exports.default = router;
//# sourceMappingURL=department.routes.js.map