import mongoose from 'mongoose';

export function skipFor(page, limit) {
  return (page - 1) * limit;
}

export function pageMeta(total, page, limit) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Turns [{ _id: 'pending', count: 3 }] into { all, pending, approved, ... } with zeros filled in. */
export function statusCounts(groups, statuses) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  let all = 0;
  for (const { _id, count } of groups) {
    if (_id in counts) counts[_id] = count;
    all += count;
  }
  return { all, ...counts };
}

/** Aggregation pipelines are not cast by Mongoose, so ids must be ObjectIds. */
export function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}
