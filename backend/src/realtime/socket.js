import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { issuedBeforePasswordChange } from '../middlewares/authenticate.js';
import { verifyAccessToken } from '../services/token.service.js';
import { USER_STATUS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Live updates over Socket.IO. Server → client only: the browser never sends data, it only listens.
 *
 * Security:
 * - The handshake needs the same short-lived access token as the API (auth: { token }); blocked or
 *   deleted users are refused.
 * - Each socket joins only its own room (`user:<id>`), so events can never reach another user.
 * - The socket is closed when the access token expires; the client renews the token and reconnects.
 * - Tiny message size limit, since clients have nothing to send.
 */
let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    maxHttpBufferSize: 1024, // clients only listen
    cors: { origin: env.clientOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('UNAUTHORIZED'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('role status passwordChangedAt').lean();
      if (!user || user.status === USER_STATUS.BLOCKED || issuedBeforePasswordChange(payload, user)) {
        return next(new Error('UNAUTHORIZED'));
      }
      socket.data.user = { id: String(user._id), role: user.role };
      socket.data.expiresAt = payload.exp * 1000;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);
    socket.join(`role:${role}`);

    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()));
    socket.on('disconnect', () => clearTimeout(expiry));
  });

  logger.info('Realtime (Socket.IO) ready');
  return io;
}

/** Sends an event to every open tab of these users. No-op when realtime is off (tests, scripts). */
export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of [userIds].flat().filter(Boolean)) io.to(`user:${String(id)}`).emit(event, payload);
}

/** Closes a user's open connections (e.g. right after an admin blocks the account). */
export function disconnectUser(userId) {
  if (!io) return;
  io.in(`user:${String(userId)}`).disconnectSockets(true);
}

export function closeRealtime() {
  return new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => resolve());
  });
}
