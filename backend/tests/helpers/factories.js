import { Category } from '../../src/models/category.model.js';
import { Product } from '../../src/models/product.model.js';
import { SellerProfile } from '../../src/models/sellerProfile.model.js';
import { User } from '../../src/models/user.model.js';
import { signAccessToken } from '../../src/services/token.service.js';
import { encrypt } from '../../src/utils/crypto.js';

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

export const PASSWORD = 'Secret@123';

/** Creates a user and returns ready-to-use auth headers (no HTTP login needed). */
export async function createUser(role = 'customer', overrides = {}) {
  const n = next();
  const user = await User.create({
    name: `Test ${role} ${n}`,
    email: `${role}${n}@example.com`,
    password: PASSWORD,
    role,
    emailVerifiedAt: new Date(),
    ...overrides,
  });
  const token = signAccessToken(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

export function storeInput(overrides = {}) {
  return {
    storeName: 'Urban Threads',
    description: 'Everyday cotton wear.',
    businessType: 'proprietorship',
    gstin: '33ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    contactEmail: 'hello@urbanthreads.in',
    contactPhone: '+919876543210',
    pickupAddress: {
      line1: '12 Mill Road',
      city: 'Tiruppur',
      state: 'Tamil Nadu',
      postalCode: '641601',
    },
    bank: {
      accountHolderName: 'Ram Kumar',
      bankName: 'HDFC Bank',
      ifsc: 'HDFC0001234',
      accountNumber: '50100123456789',
    },
    ...overrides,
  };
}

/** Seller user + store profile in the given status. */
export async function createSeller(status = 'approved') {
  const seller = await createUser('seller');
  const n = next();
  const store = await SellerProfile.create({
    user: seller.user._id,
    storeName: `Store ${n}`,
    slug: `store-${n}`,
    businessType: 'proprietorship',
    pan: 'ABCDE1234F',
    contactEmail: seller.user.email,
    contactPhone: '+919876543210',
    pickupAddress: { line1: '12 Mill Road', city: 'Tiruppur', state: 'Tamil Nadu', postalCode: '641601' },
    bank: { accountHolderName: 'Ram Kumar', bankName: 'HDFC Bank', ifsc: 'HDFC0001234', accountNumberLast4: '6789' },
    bankAccountNumberEncrypted: encrypt('50100123456789'),
    status,
    submittedAt: new Date(),
    statusHistory: [{ status }],
  });
  return { ...seller, store };
}

/** Fashion (parent) → T-Shirts (leaf), plus an inactive leaf. */
export async function createCategories() {
  const parent = await Category.create({ name: 'Fashion', slug: 'fashion', level: 0 });
  const leaf = await Category.create({ name: 'T-Shirts', slug: 'fashion-t-shirts', parent: parent._id, level: 1 });
  const inactive = await Category.create({
    name: 'Hidden',
    slug: 'fashion-hidden',
    parent: parent._id,
    level: 1,
    isActive: false,
  });
  return { parent, leaf, inactive };
}

/** An image reference that passes the ownership check for this seller (local driver). */
export function productImage(sellerId, n = 1) {
  const publicId = `marketplace/products/${sellerId}/img-${n}.png`;
  return { url: `/uploads/${publicId}`, publicId };
}

export function productInput(sellerId, categoryId, overrides = {}) {
  return {
    name: 'Classic Cotton T-Shirt',
    brand: 'Urban Threads',
    category: String(categoryId),
    description: 'A soft, breathable cotton t-shirt for everyday wear.',
    highlights: ['100% cotton'],
    images: [productImage(sellerId)],
    variants: [{ sku: 'TS-001', price: 99900, salePrice: 79900, stock: 20 }],
    ...overrides,
  };
}

export function variantInput(overrides = {}) {
  return [
    { sku: 'TS-BLK-M', attributes: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'M' }], price: 99900, salePrice: 79900, stock: 10 },
    { sku: 'TS-BLK-L', attributes: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'L' }], price: 99900, stock: 3 },
    { sku: 'TS-WHT-M', attributes: [{ name: 'Color', value: 'White' }, { name: 'Size', value: 'M' }], price: 89900, stock: 0 },
  ].map((v) => ({ ...v, ...overrides }));
}

/** Creates a product directly in the DB (skips the API). */
export async function createProduct(seller, categoryId, overrides = {}) {
  const n = next();
  return Product.create({
    ...productInput(seller.user._id, categoryId),
    variants: [{ sku: `SKU-${n}`, price: 50000, stock: 10 }],
    seller: seller.user._id,
    store: seller.store._id,
    slug: `product-${n}`,
    ...overrides,
  });
}
