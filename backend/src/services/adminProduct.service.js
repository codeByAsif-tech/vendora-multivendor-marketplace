import { Product } from '../models/product.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import { PRODUCT_STATUS, PRODUCT_STATUS_VALUES } from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { queueEmail } from './email.service.js';
import { notify } from './notification.service.js';

export async function listProducts({ status, search, store, category, page, limit }) {
  const filter = { deletedAt: null };
  if (status) filter.status = status;
  if (store) filter.store = store;
  if (category) filter.category = category;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ name: rx }, { brand: rx }, { 'variants.sku': rx }];
  }

  // Oldest pending first for the review queue, newest first otherwise.
  const sort = status === PRODUCT_STATUS.PENDING ? { updatedAt: 1 } : { updatedAt: -1 };

  const [items, total, groups] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skipFor(page, limit))
      .limit(limit)
      .select('name slug images status isActive minPrice maxPrice totalStock variants.sku store category updatedAt rejectionReason')
      .populate('store', 'storeName slug status')
      .populate('category', 'name')
      .lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    items,
    pagination: pageMeta(total, page, limit),
    counts: statusCounts(groups, PRODUCT_STATUS_VALUES),
  };
}

export async function getProduct(id) {
  const product = await Product.findOne({ _id: id, deletedAt: null })
    .populate('store', 'storeName slug status logo')
    .populate('seller', 'name email')
    .populate('category', 'name slug')
    .populate('moderatedBy', 'name');
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

export async function moderateProduct(id, { status, reason }, admin) {
  const product = await Product.findOne({ _id: id, deletedAt: null }).populate('seller', 'name email');
  if (!product) throw ApiError.notFound('Product not found');

  product.status = status;
  product.rejectionReason = status === PRODUCT_STATUS.REJECTED ? reason : undefined;
  product.moderatedBy = admin.id;
  product.moderatedAt = new Date();
  await product.save();

  const { name, email } = product.seller;
  const template = status === PRODUCT_STATUS.APPROVED ? emailTemplates.productApproved : emailTemplates.productRejected;
  queueEmail(email, template({ name, productName: product.name, reason }));
  const approved = status === PRODUCT_STATUS.APPROVED;
  notify(product.seller._id, {
    type: approved ? 'product_approved' : 'product_rejected',
    title: approved ? `"${product.name}" is live` : `"${product.name}" needs changes`,
    body: approved ? 'Customers can now find and buy it.' : reason,
    link: approved ? '/seller/products' : `/seller/products/${product._id}/edit`,
  });

  return product;
}
