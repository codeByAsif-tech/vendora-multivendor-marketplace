import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { MAX_IMAGE_BYTES } from '../utils/constants.js';
import { detectImageType } from '../utils/imageType.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function createUploader(maxFiles) {
  return multer({
    storage: multer.memoryStorage(), // files go straight to Cloudinary/disk after checks
    limits: { fileSize: MAX_IMAGE_BYTES, files: maxFiles, fields: 10 },
    fileFilter(_req, file, cb) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(ApiError.badRequest('Only JPG, PNG and WebP images are allowed'));
      }
      cb(null, true);
    },
  });
}

/** Second check: the bytes must really be an image, whatever the client claims. */
function verifyImages(req, _res, next) {
  const files = req.file
    ? [req.file]
    : Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();

  for (const file of files) {
    const type = detectImageType(file.buffer);
    if (!type) throw ApiError.badRequest(`"${file.originalname}" is not a valid JPG, PNG or WebP image`);
    file.detectedType = type;
  }
  next();
}

export const uploadSingleImage = (field) => [createUploader(1).single(field), verifyImages];

export const uploadImages = (field, maxCount) => [
  createUploader(maxCount).array(field, maxCount),
  verifyImages,
];

/** fields: [{ name: 'logo', maxCount: 1 }, ...] */
export const uploadImageFields = (fields) => [
  createUploader(fields.reduce((sum, f) => sum + f.maxCount, 0)).fields(fields),
  verifyImages,
];
