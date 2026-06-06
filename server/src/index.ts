import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import departmentRoutes from './routes/departments.js';
import applicationRoutes from './routes/applications.js';
import reviewRoutes from './routes/reviews.js';
import adminRoutes from './routes/admin.js';
import reportRoutes from './routes/reports.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initAppraisalReminderJob } from './jobs/appraisalReminder.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize scheduled background jobs
initAppraisalReminderJob();

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Appraisal System API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

// ─── Error Handler (must be last) ─────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth API:     http://localhost:${PORT}/api/auth/login`);
  console.log(`📝 Applications: http://localhost:${PORT}/api/applications`);
  console.log(`👑 Admin API:    http://localhost:${PORT}/api/admin/stats`);
});

export default app;

