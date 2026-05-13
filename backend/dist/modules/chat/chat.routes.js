"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const chat_controller_1 = require("./chat.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/users', chat_controller_1.getChatUsers);
router.get('/conversations', chat_controller_1.getConversations);
router.get('/unread-count', chat_controller_1.getUnreadCount);
router.get('/conversations/:otherId/messages', chat_controller_1.getMessages);
router.post('/conversations/:otherId/messages', chat_controller_1.sendMessage);
// Group Chat Routes
router.post('/groups', chat_controller_1.createGroup);
router.get('/groups/:groupId/messages', chat_controller_1.getGroupMessages);
router.post('/groups/:groupId/messages', chat_controller_1.sendGroupMessage);
exports.default = router;
//# sourceMappingURL=chat.routes.js.map