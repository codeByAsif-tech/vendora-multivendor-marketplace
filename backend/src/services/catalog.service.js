import { Category } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { ApiError } from '../utils/ApiError.js';
import { PRODUCT_STATUS, SELLER_STATUS } from '../utils/constants.js';
import { pageMeta, skipFor } from '../utils/pagination.js';

/** Fields of a store that anyone may see. Never include bank, PAN, GSTIN or contact details here. */
export const PUBLIC_STORE_FIELDS = 'storeName slug description logo banner createdAt pickupAddress.city pickupAddress.state';

/** Fields hidden from customers. */
const PRIVATE_PRODUCT_FIELDS = '-seller -status -rejectionReason -moderatedBy -moderatedAt -deletedAt -__v';

// Product cards. Images are added with .slice('images', 2) (cover + hover image only).
const CARD_FIELDS =
  'name slug brand minPrice maxPrice compareAtPrice maxDiscount totalStock ratingAvg ratingCount store category createdAt';

/**
 * The single rule for "customers can see this product":
 * product approved + switched on by the seller + not deleted
 * + store approved (not pending/rejected/suspended)
 * + category active (and its parent active).
 * Reused by the cart and checkout in Phase 5.
 */
export async function buildVisibilityFilter() {
  const [storeIds, categories] = await Promise.all([
    SellerProfile.distinct('_id', { status: SELLER_STATUS.APPROVED }),
    Category.find({ isActive: true }).select('_id parent').lean(),
  ]);

  const activeIds = new Set(categories.map((c) => String(c._id)));
  const categoryIds = categories
    .filter((c) => !c.parent || activeIds.has(String(c.parent)))
    .map((c) => c._id);

  return {
    status: PRODUCT_STATUS.APPROVED,
    isActive: true,
    deletedAt: null,
    store: { $in: storeIds },
    category: { $in: categoryIds },
  };
}

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { minPrice: 1, _id: 1 },
  price_desc: { minPrice: -1, _id: 1 },
  discount: { maxDiscount: -1, createdAt: -1 },
  rating: { ratingAvg: -1, ratingCount: -1, _id: 1 },
  popular: { soldCount: -1, createdAt: -1 },
};

/** Category slug → ids to filter by (a parent includes its subcategories). */
async function categoryIdsForSlug(slug, visibleIds) {
  const visible = new Set(visibleIds.map(String));
  const category = await Category.findOne({ slug }).select('_id parent').lean();
  if (!category || !visible.has(String(category._id))) throw ApiError.notFound('Category not found');

  if (category.parent) return [category._id];
  const children = await Category.find({ parent: category._id }).select('_id').lean();
  return [category._id, ...children.map((c) => c._id).filter((id) => visible.has(String(id)))];
}

async function storeIdForSlug(slug) {
  const store = await SellerProfile.findOne({ slug, status: SELLER_STATUS.APPROVED }).select('_id').lean();
  if (!store) throw ApiError.notFound('Store not found');
  return store._id;
}

/**
 * Public product listing with search, filters, sorting and pagination.
 * Also returns `facets` (brands and price range for the current search/category/store) for the filter sidebar.
 */
export async function listProducts(query) {
  const { search, category, store, brand, minPrice, maxPrice, inStock, minRating, sort, page, limit } = query;
  const visibility = await buildVisibilityFilter();

  // Filters that define the "result set" the facets describe.
  const scope = { ...visibility };
  if (category) scope.category = { $in: await categoryIdsForSlug(category, visibility.category.$in) };
  if (store) {
    const storeId = await storeIdForSlug(store);
    scope.store = { $in: visibility.store.$in.filter((id) => String(id) === String(storeId)) };
  }
  if (search) scope.$text = { $search: search };

  // Narrowing filters chosen in the sidebar.
  const filter = { ...scope };
  if (brand?.length) filter.brand = { $in: brand };
  if (minPrice != null || maxPrice != null) {
    filter.minPrice = {};
    if (minPrice != null) filter.minPrice.$gte = minPrice;
    if (maxPrice != null) filter.minPrice.$lte = maxPrice;
  }
  if (inStock) filter.totalStock = { $gt: 0 };
  if (minRating) filter.ratingAvg = { $gte: minRating };

  const useRelevance = search && sort === 'relevance';
  const sortSpec = useRelevance ? { score: { $meta: 'textScore' }, _id: 1 } : SORTS[sort] ?? SORTS.newest;

  const [items, total, [facets]] = await Promise.all([
    Product.find(filter)
      .select(CARD_FIELDS)
      .slice('images', 2)
      .sort(sortSpec)
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('store', 'storeName slug')
      .populate('category', 'name slug')
      .lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: scope },
      {
        $group: {
          _id: null,
          brands: { $addToSet: '$brand' },
          minPrice: { $min: '$minPrice' },
          maxPrice: { $max: '$minPrice' },
        },
      },
    ]),
  ]);

  return {
    items,
    pagination: pageMeta(total, page, limit),
    facets: {
      brands: (facets?.brands ?? []).filter(Boolean).sort((a, b) => a.localeCompare(b)),
      priceRange: { min: facets?.minPrice ?? 0, max: facets?.maxPrice ?? 0 },
    },
  };
}

/** Product page. Inactive variants and private fields are removed. Includes up to 8 related products. */
export async function getProductBySlug(slug) {
  const visibility = await buildVisibilityFilter();

  const product = await Product.findOne({ slug, ...visibility })
    .select(PRIVATE_PRODUCT_FIELDS)
    .populate('store', PUBLIC_STORE_FIELDS)
    .populate({ path: 'category', select: 'name slug parent', populate: { path: 'parent', select: 'name slug' } })
    .lean();
  if (!product) throw ApiError.notFound('Product not found');

  product.variants = product.variants.filter((v) => v.isActive !== false);

  const related = await Product.find({ ...visibility, category: product.category._id, _id: { $ne: product._id } })
    .select(CARD_FIELDS)
    .slice('images', 2)
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(8)
    .populate('store', 'storeName slug')
    .lean();

  return { product, related };
}

/** Category page header: the category, its parent (breadcrumbs) and its visible subcategories. */
export async function getCategoryBySlug(slug) {
  const category = await Category.findOne({ slug, isActive: true })
    .select('name slug description image parent')
    .populate('parent', 'name slug isActive')
    .lean();
  if (!category || (category.parent && !category.parent.isActive)) throw ApiError.notFound('Category not found');

  const children = category.parent
    ? []
    : await Category.find({ parent: category._id, isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .select('name slug image')
        .lean();

  if (category.parent) delete category.parent.isActive;
  return { ...category, children };
}

/** Public store page header. */
export async function getStoreBySlug(slug) {
  const store = await SellerProfile.findOne({ slug, status: SELLER_STATUS.APPROVED }).select(PUBLIC_STORE_FIELDS).lean();
  if (!store) throw ApiError.notFound('Store not found');

  const visibility = await buildVisibilityFilter();
  const productCount = await Product.countDocuments({ ...visibility, store: store._id });
  return { ...store, productCount };
}
