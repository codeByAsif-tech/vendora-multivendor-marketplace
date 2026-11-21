import { Router } from 'express';
import * as engagement from '../controllers/engagement.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { ROLES } from '../utils/constants.js';
import { idParams } from '../validators/common.validator.js';
import { myReturnsQuery, notificationsQuery } from '../validators/engagement.validator.js';

/* Phase 9 routers that are not under /products, /orders, /seller or /admin. */

// ------------------------------ Notifications ------------------------------
// Every signed-in user (customer, seller, admin) has their own notifications.
export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', validate({ query: notificationsQuery }), engagement.myNotifications);
notificationRouter.get('/unread-count', engagement.unreadCount);
notificationRouter.post('/read-all', engagement.markAllRead);
notificationRouter.patch('/:id/read', validate({ params: idParams }), engagement.markRead);

// --------------------------------- Returns ---------------------------------
// Customer's own returns. Requesting one is POST /orders/:orderNumber/returns.
export const returnRouter = Router();
returnRouter.use(authenticate, authorize(ROLES.CUSTOMER));
returnRouter.get('/', validate({ query: myReturnsQuery }), engagement.myReturns);
