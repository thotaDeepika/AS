import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, JwtPayload } from '../middleware/auth.js';
import { UnauthorizedError, ValidationError } from '../lib/errors.js';
import { AuditAction } from '@prisma/client';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { sendEmail } from '../lib/email.js';

const router = Router();

// OTP Endpoints Rate Limiter (5 attempts per 15 minutes per IP)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many OTP requests or reset attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Validation Schemas ───────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: { select: { name: true, code: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated. Contact administrator.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET!;
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, secret, { expiresIn: expiresIn as any });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: AuditAction.LOGIN,
        entity_type: 'User',
        entity_id: user.id,
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          designation: user.designation,
          department: user.department,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        designation: true,
        is_active: true,
        created_at: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) throw new UnauthorizedError('User not found');

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/auth/change-password ────────────────────────────────────────────

router.put('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) throw new UnauthorizedError('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) throw new ValidationError('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/logout (audit only) ───────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.LOGOUT,
        entity_type: 'User',
        entity_id: req.user!.id,
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────

router.post('/forgot-password', otpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Enforce email registration (user must already exist)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ValidationError('Email is not registered in our system.');
    }

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Hash it for DB storage
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Expire in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save/upsert to DB
    await prisma.otpVerification.upsert({
      where: { email },
      create: {
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
      update: {
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
    });

    // Compose custom email template
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">Appraisal System Password Reset</h2>
        <p>Hello ${user.name},</p>
        <p>We received a request to reset your password for your RIT Faculty Appraisal System account. Please use the following One-Time Password (OTP) to complete the reset. This OTP is valid for <strong>10 minutes</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 6px; margin: 20px 0;">
          ${otp}
        </div>
        <p>If you did not request this password reset, please ignore this email or contact the administrator if you have concerns.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">Ramaiah Institute of Technology, Bangalore</p>
      </div>
    `;

    // Dispatch in background
    sendEmail(email, 'Password Reset OTP - Appraisal System', emailHtml).catch(err => {
      console.error('Failed to send password reset OTP email:', err);
    });

    res.json({ success: true, message: 'OTP sent successfully to your registered email.' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────

router.post('/reset-password', otpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);

    // Check user existence
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new ValidationError('Email is not registered in our system.');
    }

    // Retrieve active OTP verification
    const record = await prisma.otpVerification.findUnique({
      where: { email },
    });

    if (!record) {
      throw new ValidationError('No active OTP verification request found for this email.');
    }

    // Check expiration
    if (record.expires_at < new Date()) {
      throw new ValidationError('OTP has expired. Please request a new one.');
    }

    // Verify OTP hash
    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (inputHash !== record.otp_hash) {
      throw new ValidationError('Invalid OTP code. Please try again.');
    }

    // Update password and delete OTP verification in single transaction
    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { password_hash: newHash },
      }),
      prisma.otpVerification.delete({
        where: { email },
      }),
    ]);

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: AuditAction.STATUS_CHANGED,
        entity_type: 'User',
        entity_id: user.id,
        details: { action: 'password_reset_via_otp' },
        ip_address: req.ip || req.socket.remoteAddress || '',
      },
    });

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
