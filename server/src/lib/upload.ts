import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ValidationError } from './errors.js';

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ValidationError('Only PDF files or images are allowed'));
  }
};

const maxSize = (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSize },
});

export default upload;
