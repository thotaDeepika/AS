import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationStatus, AuditAction, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
router.use(authorize(Role.ADMIN));

// ─── POST /api/admin/assign-reviewer — Assign reviewer to application ────────

const assignSchema = z.object({
  application_id: z.string(),
  reviewer_id: z.string(),
});

router.post('/assign-reviewer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { application_id, reviewer_id } = assignSchema.parse(req.body);

    const application = await prisma.application.findUnique({ where: { id: application_id } });
    if (!application) throw new NotFoundError('Application');
    if (application.status !== ApplicationStatus.HOD_REVIEWED) {
      throw new ValidationError(`Cannot assign reviewer. Application must be in HOD_REVIEWED status (current: ${application.status})`);
    }

    const reviewer = await prisma.user.findUnique({ where: { id: reviewer_id } });
    if (!reviewer) throw new NotFoundError('Reviewer user');
    if (!reviewer.is_active) throw new ValidationError('Reviewer account is inactive');

    // Ensure reviewer is not the faculty who submitted
    if (reviewer_id === application.faculty_id) {
      throw new ValidationError('Cannot assign the applicant as their own reviewer');
    }

    const updated = await prisma.application.update({
      where: { id: application_id },
      data: {
        status: ApplicationStatus.REVIEWER_ASSIGNED,
        reviewer_id: reviewer_id,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.REVIEWER_ASSIGNED,
        entity_type: 'Application',
        entity_id: application_id,
        details: { reviewer_id, reviewer_name: reviewer.name },
      },
    });

    res.json({
      success: true,
      data: { application: updated },
      message: `Reviewer ${reviewer.name} assigned successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/forward-to-principal — Forward to Principal ─────────────

const forwardSchema = z.object({
  application_ids: z.array(z.string()).min(1),
});

router.post('/forward-to-principal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { application_ids } = forwardSchema.parse(req.body);

    const applications = await prisma.application.findMany({
      where: { id: { in: application_ids } },
    });

    const invalid = applications.filter(a => a.status !== ApplicationStatus.REVIEWER_REVIEWED);
    if (invalid.length > 0) {
      throw new ValidationError(`${invalid.length} application(s) are not in REVIEWER_REVIEWED status and cannot be forwarded`);
    }

    // Note: No explicit status change here — Principal reviews from REVIEWER_REVIEWED
    // The Review API handles the transition when Principal acts
    // But we create an audit trail for the forwarding action

    for (const app of applications) {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.id,
          action: AuditAction.STATUS_CHANGED,
          entity_type: 'Application',
          entity_id: app.id,
          details: { action: 'forwarded_to_principal' },
        },
      });
    }

    res.json({
      success: true,
      message: `${applications.length} application(s) forwarded to Principal`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/freeze — Freeze approved applications ──────────────────

const freezeSchema = z.object({
  application_ids: z.array(z.string()).min(1),
});

router.post('/freeze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { application_ids } = freezeSchema.parse(req.body);

    const applications = await prisma.application.findMany({
      where: { id: { in: application_ids } },
      include: { reviews: { where: { reviewer: { role: Role.PRINCIPAL } }, orderBy: { reviewed_at: 'desc' }, take: 1 } },
    });

    // Only PRINCIPAL_REVIEWED + APPROVED can be frozen
    const invalid = applications.filter(a => {
      if (a.status !== ApplicationStatus.PRINCIPAL_REVIEWED) return true;
      const principalReview = a.reviews[0];
      return !principalReview || principalReview.decision !== 'APPROVED';
    });

    if (invalid.length > 0) {
      throw new ValidationError(`${invalid.length} application(s) cannot be frozen. They must be PRINCIPAL_REVIEWED with APPROVED decision.`);
    }

    await prisma.application.updateMany({
      where: { id: { in: application_ids } },
      data: { status: ApplicationStatus.FROZEN },
    });

    for (const app of applications) {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.id,
          action: AuditAction.APPLICATION_FROZEN,
          entity_type: 'Application',
          entity_id: app.id,
          details: { frozen_by: req.user!.id },
        },
      });
    }

    res.json({
      success: true,
      message: `${applications.length} application(s) frozen successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/send-to-accounts — Send frozen apps to Accounts ────────

const accountsSchema = z.object({
  application_ids: z.array(z.string()).min(1),
});

router.post('/send-to-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { application_ids } = accountsSchema.parse(req.body);

    const applications = await prisma.application.findMany({
      where: { id: { in: application_ids } },
    });

    const invalid = applications.filter(a => a.status !== ApplicationStatus.FROZEN);
    if (invalid.length > 0) {
      throw new ValidationError(`${invalid.length} application(s) are not FROZEN and cannot be sent to accounts`);
    }

    await prisma.application.updateMany({
      where: { id: { in: application_ids } },
      data: { status: ApplicationStatus.SENT_TO_ACCOUNTS },
    });

    for (const app of applications) {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.id,
          action: AuditAction.SENT_TO_ACCOUNTS,
          entity_type: 'Application',
          entity_id: app.id,
          details: { sent_by: req.user!.id },
        },
      });
    }

    res.json({
      success: true,
      message: `${applications.length} application(s) sent to Accounts department`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/stats — Dashboard statistics ─────────────────────────────

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [statusCounts, userCounts, departmentCount] = await Promise.all([
      prisma.application.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.user.groupBy({ by: ['role'], where: { is_active: true }, _count: { id: true } }),
      prisma.department.count(),
    ]);

    const stats = {
      applications: Object.fromEntries(
        statusCounts.map(s => [s.status, s._count.id])
      ),
      total_applications: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
      users: Object.fromEntries(
        userCounts.map(u => [u.role, u._count.id])
      ),
      total_users: userCounts.reduce((sum, u) => sum + u._count.id, 0),
      total_departments: departmentCount,
    };

    res.json({ success: true, data: { stats } });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/audit-logs — View audit logs ─────────────────────────────

router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', action, user_id } = req.query;
    const where: any = {};
    if (action) where.action = action;
    if (user_id) where.user_id = user_id;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/admin/scoring-categories — List all categories + rules ─────────

router.get('/scoring-categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.scoringCategory.findMany({
      orderBy: { sl_no: 'asc' },
      include: { scoring_rules: true },
    });

    res.json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
});

export default router;
