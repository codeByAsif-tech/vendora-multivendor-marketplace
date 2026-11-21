/**
 * Creates the first admin account from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 * Admins cannot register through the public API.
 *
 * Usage: npm run seed:admin
 */
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { ROLES } from '../src/utils/constants.js';

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || 'Platform Admin';
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    console.error('ADMIN_PASSWORD must be 8+ characters with a capital letter, a number and a special character.');
    process.exit(1);
  }

  await connectDB(env.MONGODB_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      console.log(`A ${existing.role} account already uses ${email}. Choose a different ADMIN_EMAIL.`);
    } else if (!existing.emailVerifiedAt) {
      // Admins created before email verification existed
      existing.emailVerifiedAt = new Date();
      await existing.save({ validateModifiedOnly: true });
      console.log(`Admin ${email} already exists. Email marked as verified.`);
    } else {
      console.log(`Admin ${email} already exists. Nothing to do.`);
    }
  } else {
    await User.create({ name, email, password, role: ROLES.ADMIN, emailVerifiedAt: new Date() });
    console.log(`Admin created: ${email}`);
  }

  await disconnectDB();
}

seedAdmin().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
