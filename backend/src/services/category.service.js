import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/text.js';
import { assetFolders, deleteImagesLater, uploadImage } from './storage.service.js';

const buildSlug = (name, parent) => (parent ? `${parent.slug}-${slugify(name)}` : slugify(name));

/** Public: active categories as a tree. Children of inactive parents are hidden too. */
export async function getCategoryTree() {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select('name slug description image parent level')
    .lean();

  const childrenOf = (id) => categories.filter((c) => c.parent && String(c.parent) === String(id));
  return categories.filter((c) => !c.parent).map((parent) => ({ ...parent, children: childrenOf(parent._id) }));
}

/** Admin: every category (flat, parents first) with its product count. */
export async function listCategoriesForAdmin() {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ level: 1, sortOrder: 1, name: 1 }).select('-__v').lean(),
    Product.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));
  return categories.map((c) => ({ ...c, productCount: countById.get(String(c._id)) ?? 0 }));
}

/** Validates a parent: must exist, be top-level (max 2 levels), and not hold products directly. */
async function resolveParent(parentId, selfId) {
  if (!parentId) return null;
  if (selfId && String(parentId) === String(selfId)) {
    throw ApiError.field('parent', 'A category cannot be its own parent');
  }

  const parent = await Category.findById(parentId).lean();
  if (!parent) throw ApiError.field('parent', 'Parent category not found');
  if (parent.parent) throw ApiError.field('parent', 'Subcategories cannot have their own subcategories');

  const hasProducts = await Product.exists({ category: parent._id, deletedAt: null });
  if (hasProducts) {
    throw ApiError.conflict(`"${parent.name}" already has products. Move them before adding subcategories.`);
  }
  return parent;
}

async function assertSlugFree(slug, excludeId) {
  if (!slug) throw ApiError.field('name', 'Name must contain letters or numbers');
  const filter = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
  if (await Category.exists(filter)) throw ApiError.conflict('A category with this name already exists here');
}

export async function createCategory(input) {
  const parent = await resolveParent(input.parent);
  const slug = buildSlug(input.name, parent);
  await assertSlugFree(slug);

  return Category.create({
    ...input,
    parent: parent?._id ?? null,
    level: parent ? 1 : 0,
    slug,
  });
}

export async function updateCategory(id, input) {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');

  let parent = category.parent ? await Category.findById(category.parent).lean() : null;

  const parentChanged = 'parent' in input && String(input.parent ?? '') !== String(category.parent ?? '');
  if (parentChanged) {
    if (await Category.exists({ parent: category._id })) {
      throw ApiError.field('parent', 'A category that has subcategories cannot be moved');
    }
    parent = await resolveParent(input.parent, category._id);
    category.parent = parent?._id ?? null;
    category.level = parent ? 1 : 0;
  }

  for (const key of ['name', 'description', 'isActive', 'sortOrder']) {
    if (input[key] !== undefined) category[key] = input[key];
  }

  const newSlug = buildSlug(category.name, parent);
  const slugChanged = newSlug !== category.slug;
  if (slugChanged) {
    await assertSlugFree(newSlug, category._id);
    category.slug = newSlug;
  }

  await category.save();

  // Subcategory slugs include the parent slug, so keep them in sync.
  if (slugChanged && category.level === 0) {
    const children = await Category.find({ parent: category._id });
    for (const child of children) {
      child.slug = buildSlug(child.name, category);
      await child.save();
    }
  }

  return category;
}

export async function setCategoryImage(id, file) {
  if (!file) throw ApiError.badRequest('Choose an image to upload');
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');

  const previous = category.image?.publicId;
  category.image = await uploadImage(file, assetFolders.category());
  await category.save();
  deleteImagesLater([previous]);
  return category;
}

export async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');

  if (await Category.exists({ parent: category._id })) {
    throw ApiError.conflict('Delete or move its subcategories first');
  }
  if (await Product.exists({ category: category._id, deletedAt: null })) {
    throw ApiError.conflict('This category still has products. Move them to another category first.');
  }

  await category.deleteOne();
  deleteImagesLater([category.image?.publicId]);
}

/** Products may only be attached to an active leaf category. */
export async function assertAssignableCategory(categoryId) {
  const category = await Category.findById(categoryId).select('isActive parent').lean();
  if (!category || !category.isActive) throw ApiError.field('category', 'Choose an active category');

  if (await Category.exists({ parent: category._id })) {
    throw ApiError.field('category', 'Choose a subcategory');
  }
  if (category.parent) {
    const parent = await Category.findById(category.parent).select('isActive').lean();
    if (!parent?.isActive) throw ApiError.field('category', 'Choose an active category');
  }
}
