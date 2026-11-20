const multer = require('multer');
const FileType = require('file-type');
const { supabaseAdmin } = require('../config/supabase');

const storage = multer.memoryStorage();

// Standard image filter
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

// KYC filter: images and PDF documents permitted
const kycFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format for KYC. Only JPEG, PNG, WebP, and PDF documents are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: imageFileFilter,
});

const kycUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: kycFileFilter,
});

/**
 * Helper to upload buffer to Supabase Storage with cryptographic magic byte verification.
 * For private buckets ('kyc-documents', 'chat-attachments'): returns relative object path only.
 * For public buckets ('listing-images', 'avatars'): returns public URL.
 */
const uploadToSupabaseStorage = async (file, bucketName = 'listing-images', folder = '') => {
  if (!file || !file.buffer) {
    throw new Error('File buffer is empty or missing');
  }

  // 1. Cryptographic magic bytes inspection (Phase 1.6)
  const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedKycMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const allowedForBucket = bucketName === 'kyc-documents' ? allowedKycMimes : allowedImageMimes;

  const detected = await FileType.fromBuffer(file.buffer);
  if (!detected || !allowedForBucket.includes(detected.mime)) {
    throw new Error(
      `Magic byte validation failed: Detected format '${detected ? detected.mime : 'unknown'}' is not allowed for ${bucketName}.`
    );
  }

  const extension = detected.ext || file.mimetype.split('/')[1] || 'bin';
  const cleanFolder = folder ? `${folder}/`.replace(/\/+/g, '/') : '';
  const fileName = `${cleanFolder}${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(fileName, file.buffer, {
      contentType: detected.mime,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload to storage bucket ${bucketName}: ${error.message}`);
  }

  // 2. Private bucket protection: Do NOT generate public URLs for sensitive documents or chat attachments
  if (bucketName === 'kyc-documents' || bucketName === 'chat-attachments') {
    return fileName; // Store only storage path
  }

  // Public buckets (avatars, listing-images)
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};

module.exports = {
  upload,
  kycUpload,
  uploadToSupabaseStorage,
};
