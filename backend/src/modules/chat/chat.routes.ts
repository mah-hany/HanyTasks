import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { getConversations, getMessages, sendMessage, getChatUsers, getUnreadCount, createGroup, getGroupMessages, sendGroupMessage } from './chat.controller';

const router = Router();

router.use(authenticate);

router.get('/users',                          getChatUsers);
router.get('/conversations',                  getConversations);
router.get('/unread-count',                   getUnreadCount);
router.get('/conversations/:otherId/messages', getMessages);
router.post('/conversations/:otherId/messages', sendMessage);

// Group Chat Routes
router.post('/groups',                        createGroup);
router.get('/groups/:groupId/messages',       getGroupMessages);
router.post('/groups/:groupId/messages',      sendGroupMessage);

export default router;
