import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationStatus, AuditAction, ReviewDecision, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  decision: z.enum(['RECOMMENDED', 'NOT_RECOMMENDED', 'APPROVED', 'REJECTED']),
  comments: z.string().max(2000).optional(),
});

// Workflow transition map — which status + role combinations are valid
const WORKFLOW_TRANSITIONS: Record<string, { allowedRoles: Role[]; nextStatus: ApplicationStatus; allowedDecisions: ReviewDecision[] }> = {
  [ApplicationStatus.SUBMITTED]: {
    allowedRoles: [Role.HOD],
    nextStatus: ApplicationStatus.HOD_REVIEWED,
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED],
  },
  [ApplicationStatus.REVIEWER_ASSIGNED]: {
    allowedRoles: [Role.REVIEWER],
    nextStatus: ApplicationStatus.REVIEWER_REVIEWED,
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED],
  },
  [ApplicationStatus.REVIEWER_REVIEWED]: {
    allowedRoles: [Role.PRINCIPAL],
    nextStatus: ApplicationStatus.PRINCIPAL_REVIEWED,
    allowedDecisions: [ReviewDecision.APPROVED, ReviewDecision.REJECTED],
  },
};

// ─── POST /api/reviews/:applicationId — Submit a review ──────────────────────

router.post('/:applicationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, comments } = reviewSchema.parse(req.body);
    const user = req.user!;

    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: { faculty: { select: { department_id: true } } },
    });

    if (!application) throw new NotFoundError('Application');

    // Check if current status allows this review
    const transition = WORKFLOW_TRANSITIONS[application.status];
    if (!transition) {
      throw new ValidationError(`Application status "${application.status}" does not accept reviews`);
    }

    // Check role authorization
    if (!transition.allowedRoles.includes(user.role as Role)) {
      throw new ForbiddenError(`Your role (${user.role}) cannot review at this stage`);
    }

    // Check decision is valid for this stage
    if (!transition.allowedDecisions.includes(decision as ReviewDecision)) {
      throw new ValidationError(`Decision "${decision}" is not valid at this stage. Allowed: ${transition.allowedDecisions.join(', ')}`);
    }

    // Role-specific access control
    if (user.role === Role.HOD) {
      if (application.faculty.department_id !== user.department_id) {
        throw new ForbiddenError('Cannot review applications outside your department');
      }
    }
    if (user.role === Role.REVIEWER) {
      if (application.reviewer_id !== user.id) {
        throw new ForbiddenError('This application is not assigned to you');
      }
    }

    // Create review record
    const review = await prisma.review.create({
      data: {
        application_id: application.id,
        reviewer_user_id: user.id,
        role_at_review: user.role as Role,
        decision: decision as ReviewDecision,
        comments: comments || null,
      },
    });

    // Update application status
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: { status: transition.nextStatus },
    });

    // Audit log
    const actionMap: Record<string, AuditAction> = {
      [Role.HOD]: AuditAction.APPLICATION_HOD_REVIEWED,
      [Role.REVIEWER]: AuditAction.APPLICATION_REVIEWER_REVIEWED,
      [Role.PRINCIPAL]: AuditAction.APPLICATION_PRINCIPAL_REVIEWED,
    };

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: actionMap[user.role] || AuditAction.STATUS_CHANGED,
        entity_type: 'Application',
        entity_id: application.id,
        details: {
          decision,
          comments,
          from_status: application.status,
          to_status: transition.nextStatus,
        },
      },
    });

    res.json({
      success: true,
      data: { review, application: updated },
      message: `Application ${decision.toLowerCase().replace('_', ' ')} successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/reviews/:applicationId — Get reviews for an application ────────

router.get('/:applicationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
    });
    if (!application) throw new NotFoundError('Application');

    const reviews = await prisma.review.findMany({
      where: { application_id: req.params.applicationId },
      include: {
        reviewer: { select: { id: true, name: true, role: true, email: true } },
      },
      orderBy: { reviewed_at: 'asc' },
    });

    res.json({ success: true, data: { reviews } });
  } catch (error) {
    next(error);
  }
});

export default router;
