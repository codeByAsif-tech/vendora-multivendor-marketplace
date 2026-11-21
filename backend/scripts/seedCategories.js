/**
 * Adds a starter category tree with photos (safe to run more than once).
 * - Existing slugs are not created again.
 * - Categories without an image get the starter photo; images an admin uploaded are never replaced.
 * Usage: npm run seed:categories
 */
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Category } from '../src/models/category.model.js';
import { slugify } from '../src/utils/text.js';

const TREE = {
  Fashion: ["Men's Clothing", "Women's Clothing", 'Footwear', 'Watches', 'Bags & Wallets'],
  Electronics: ['Mobiles', 'Laptops', 'Headphones', 'Cameras', 'Accessories'],
  'Home & Kitchen': ['Cookware', 'Home Decor', 'Furniture', 'Bedding'],
  'Beauty & Personal Care': ['Skincare', 'Haircare', 'Fragrances'],
  'Sports & Fitness': ['Fitness Equipment', 'Sportswear', 'Outdoor'],
  Books: [],
};

/** Free Unsplash photos (https://unsplash.com/license), hot-linked from their CDN. Keyed by category name. */
const PHOTOS = {
  Fashion: '1445205170230-053b83016050',
  "Men's Clothing": '1490578474895-699cd4e2cf59',
  "Women's Clothing": '1483985988355-763728e1935b',
  Footwear: '1542291026-7eec264c27ff',
  Watches: '1523275335684-37898b6baf30',
  'Bags & Wallets': '1548036328-c9fa89d128fa',
  Electronics: '1498049794561-7780e7231661',
  Mobiles: '1511707171634-5f897ff02aa9',
  Laptops: '1496181133206-80ce9b88a853',
  Headphones: '1505740420928-5e560c06d30e',
  Cameras: '1516035069371-29a1b244cc32',
  Accessories: '1606220588913-b3aacb4d2f46',
  'Home & Kitchen': '1556911220-bff31c812dba',
  Cookware: '1556909114-f6e7ad7d3136',
  'Home Decor': '1513694203232-719a280e022f',
  Furniture: '1555041469-a586c61ea9bc',
  Bedding: '1522771739844-6a9f6d5f14af',
  'Beauty & Personal Care': '1596462502278-27bfdc403348',
  Skincare: '1556228578-8c89e6adf883',
  Haircare: '1527799820374-dcf8d9d4a388',
  Fragrances: '1541643600914-78b084683601',
  'Sports & Fitness': '1517836357463-d25dfeac3438',
  'Fitness Equipment': '1534438327276-14e5300c3a48',
  Sportswear: '1571019613454-1cb2f99b2d8b',
  Outdoor: '1504280390367-361c6d9f38f4',
  Books: '1512820790803-83ca734da794',
};

/** No publicId: these are not our uploads, so nothing is ever deleted from storage for them. */
function photoFor(name) {
  const id = PHOTOS[name];
  return id ? { url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=600&q=80` } : undefined;
}

/** Creates the category, or gives an existing one the starter photo if it has no image yet. */
async function upsert(fields) {
  const image = photoFor(fields.name);
  const existing = await Category.findOne({ slug: fields.slug });
  if (!existing) return { category: await Category.create({ ...fields, image }), created: true, imaged: Boolean(image) };

  if (image && !existing.image?.url) {
    existing.image = image;
    await existing.save();
    return { category: existing, created: false, imaged: true };
  }
  return { category: existing, created: false, imaged: false };
}

async function seed() {
  await connectDB(env.MONGODB_URI);
  let created = 0;
  let imaged = 0;
  const count = (result) => {
    if (result.created) created += 1;
    if (result.imaged) imaged += 1;
    return result.category;
  };

  for (const [index, [name, children]] of Object.entries(TREE).entries()) {
    const slug = slugify(name);
    const parent = count(await upsert({ name, slug, level: 0, sortOrder: index }));

    for (const [childIndex, childName] of children.entries()) {
      count(
        await upsert({
          name: childName,
          slug: `${slug}-${slugify(childName)}`,
          parent: parent._id,
          level: 1,
          sortOrder: childIndex,
        }),
      );
    }
  }

  console.log(`Categories created: ${created}, photos added: ${imaged}`);
  await disconnectDB();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
