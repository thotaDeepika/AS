import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Role, Designation, AuditAction } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import { sendEmail } from '../lib/email.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.nativeEnum(Role),
  designation: z.nativeEnum(Designation).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  joining_date: z.string().optional().nullable(),
  password: z.string().min(8).optional(), // defaults to Admin@123
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  designation: z.nativeEnum(Designation).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  joining_date: z.string().optional().nullable(),
});

// ─── GET /api/users ───────────────────────────────────────────────────────────

router.get('/', authorize(Role.ADMIN, Role.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const department_id = req.query.department_id as string | undefined;
    const search = req.query.search as string | undefined;
    const page = req.query.page as string | undefined || '1';
    const limit = req.query.limit as string | undefined || '20';

    const where: any = {};
    if (role) where.role = role;
    if (department_id) where.department_id = department_id;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          designation: true,
          is_active: true,
          joining_date: true,
          created_at: true,
          department: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: { users, pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) } },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/users/:id ──────────────────────────────────────────────────────

router.get('/:id', authorize(Role.ADMIN, Role.PRINCIPAL, Role.HOD), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        designation: true,
        is_active: true,
        joining_date: true,
        created_at: true,
        updated_at: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) throw new NotFoundError('User');

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/users ─────────────────────────────────────────────────────────

router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);

    if (data.role === Role.FACULTY || data.role === Role.HOD) {
      if (!data.department_id) {
        throw new ValidationError('Department is required for Faculty and HOD roles');
      }
    } else {
      data.department_id = null;
    }

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictError('A user with this email already exists');

    const password_hash = await bcrypt.hash(data.password || 'Admin@123', 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        designation: data.designation,
        department_id: data.department_id,
        joining_date: data.joining_date ? new Date(data.joining_date) : null,
        password_hash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        designation: true,
        is_active: true,
        joining_date: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });

    // Send credentials via email
    const rawPassword = data.password || 'Admin@123';
    const subject = 'Welcome to RIT Appraisal System - Your Credentials';
    const body = `
      <h2>Welcome, ${user.name}</h2>
      <p>An administrator has created an account for you in the RIT Faculty Appraisal System.</p>
      <p>Your login credentials are as follows:</p>
      <ul>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>Password:</strong> ${rawPassword}</li>
      </ul>
      <br/>
      <p>Best regards,<br/>Admin Team</p>
    `;
    sendEmail(user.email, subject, body).catch(e => console.error("Failed to send welcome email:", e));

    // Audit
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.USER_CREATED,
        entity_type: 'User',
        entity_id: user.id,
        details: { email: user.email, role: user.role },
      },
    });

    res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/users/:id ──────────────────────────────────────────────────────

router.put('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateUserSchema.parse(req.body);

    const currentUser = await prisma.user.findUnique({
      where: { id: req.params.id as string }
    });
    if (!currentUser) throw new NotFoundError('User');

    const role = parsed.role !== undefined ? parsed.role : currentUser.role;
    let department_id = parsed.department_id !== undefined ? parsed.department_id : currentUser.department_id;

    if (role === Role.FACULTY || role === Role.HOD) {
      if (!department_id) {
        throw new ValidationError('Department is required for Faculty and HOD roles');
      }
    } else {
      department_id = null;
    }

    const data: any = {
      ...parsed,
      department_id,
    };
    if (parsed.joining_date !== undefined) {
      data.joining_date = parsed.joining_date ? new Date(parsed.joining_date) : null;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        designation: true,
        is_active: true,
        joining_date: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.USER_UPDATED,
        entity_type: 'User',
        entity_id: user.id,
        details: data,
      },
    });

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/users/department/:departmentId ──────────────────────────────────

router.get('/department/:departmentId', authorize(Role.ADMIN, Role.PRINCIPAL, Role.HOD), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { department_id: req.params.departmentId as string, is_active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        designation: true,
      },
    });

    res.json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/users/:id ───────────────────────────────────────────────────

router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    if (id === req.user!.id) {
      throw new ValidationError('Cannot delete your own admin account');
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    if (user.role === Role.ADMIN) {
      throw new ValidationError('Cannot delete administrator accounts');
    }

    // Perform cascading deletion in a transaction
    await prisma.$transaction([
      // 1. Unassign reviewer from any applications they were assigned to
      prisma.application.updateMany({
        where: { reviewer_id: id },
        data: { reviewer_id: null },
      }),
      // 2. Delete all reviews written by this user
      prisma.review.deleteMany({
        where: { reviewer_user_id: id },
      }),
      // 3. Delete all applications owned by this user (this will cascade delete CategoryEntry, ProofDocument, Review)
      prisma.application.deleteMany({
        where: { faculty_id: id },
      }),
      // 4. Delete all audit logs generated by this user
      prisma.auditLog.deleteMany({
        where: { user_id: id },
      }),
      // 5. Delete the user profile
      prisma.user.delete({
        where: { id },
      }),
    ]);

    // Create an audit log for the deletion action under the current admin
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.USER_UPDATED,
        entity_type: 'User',
        entity_id: id,
        details: { action: 'deleted', deleted_user: { id: user.id, email: user.email, name: user.name } },
      },
    });

    res.json({ success: true, message: `User "${user.name}" deleted successfully` });
  } catch (error) {
    next(error);
  }
});

export default router;
