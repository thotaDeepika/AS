import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import prisma from './prisma.js';
import { ValidationError } from './errors.js';

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const MAX_TOTAL_APP_SIZE_MB = Number(process.env.MAX_TOTAL_APP_SIZE_MB) || 50;
export const MAX_TOTAL_APP_SIZE_BYTES = MAX_TOTAL_APP_SIZE_MB * 1024 * 1024;

export const MAX_FILES_PER_APP = Number(process.env.MAX_FILES_PER_APP) || 40;

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Invalid file type. Only PDF documents and image files (JPG, PNG, WEBP) are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

/**
 * Validate binary file magic bytes to prevent file extension spoofing.
 */
export function validateFileHeader(buffer: Buffer, mimetype: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (mimetype === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // PNG: 0x89 0x50 0x4E 0x47
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }

  // JPEG / JPG: 0xFF 0xD8 0xFF
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // WEBP: RIFF...WEBP
  if (mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  return true;
}

/**
 * Check total application upload size quota and document count limits.
 */
export async function checkApplicationUploadQuota(applicationId: string, newFileSizeBytes: number): Promise<{ totalBytes: number; fileCount: number }> {
  const existingEntries = await prisma.categoryEntry.findMany({
    where: { application_id: applicationId },
    select: {
      proof_documents: {
        select: { file_size: true },
      },
    },
  });

  let totalBytes = 0;
  let fileCount = 0;

  for (const entry of existingEntries) {
    for (const doc of entry.proof_documents) {
      totalBytes += Number(doc.file_size || 0);
      fileCount += 1;
    }
  }

  if (fileCount >= MAX_FILES_PER_APP) {
    throw new ValidationError(`Maximum document limit reached (${MAX_FILES_PER_APP} files per application). Please delete unneeded documents before uploading more.`);
  }

  if (totalBytes + newFileSizeBytes > MAX_TOTAL_APP_SIZE_BYTES) {
    const currentMB = (totalBytes / (1024 * 1024)).toFixed(1);
    const newMB = (newFileSizeBytes / (1024 * 1024)).toFixed(1);
    throw new ValidationError(`Total application upload quota exceeded (${currentMB} MB used + ${newMB} MB > ${MAX_TOTAL_APP_SIZE_MB} MB limit). Please delete existing files to free up quota.`);
  }

  return { totalBytes: totalBytes + newFileSizeBytes, fileCount: fileCount + 1 };
}

/**
 * Dedicated Rate Uploader Middleware to prevent upload spam & DoS attacks.
 * Allows maximum 20 uploads per minute per user/IP.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    success: false,
    error: 'Upload rate limit exceeded. Please wait a minute before uploading more files.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default upload;
