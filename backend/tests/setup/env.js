import os from 'node:os';
import path from 'node:path';
import { inject } from 'vitest';

// Runs before every test file, before the app is imported.
// Values are set before dotenv loads, so they always win over a local .env file.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = inject('mongoUri');
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '7';
// 0 = no grace window, so reuse detection can be tested immediately.
process.env.REFRESH_REUSE_GRACE_SECONDS = '0';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.COOKIE_SAMESITE = 'lax';
process.env.COOKIE_SECURE = 'false';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SMTP_HOST = '';
process.env.UPLOAD_DRIVER = 'local';
process.env.DEFAULT_COMMISSION_RATE = '10';
process.env.EARNINGS_HOLD_DAYS = '7';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'marketplace-test-uploads');
