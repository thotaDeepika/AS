import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationStatus, AuditAction, ReviewDecision, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';
import { upload } from '../lib/upload.js';
import supabase from '../lib/supabase.js';
import { sendEmail } from '../lib/email.js';

const router = Router();
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  decision: z.enum(['RECOMMENDED', 'NOT_RECOMMENDED', 'APPROVED', 'REJECTED', 'REVERTED']),
  comments: z.string().max(2000).optional(),
  reviewer_score: z.number().min(0).max(1000).optional(),
  final_score: z.number().min(0).max(1000).optional(),
  signature_path: z.string().optional(),
});

// Workflow transition map — which status + role combinations are valid
const WORKFLOW_TRANSITIONS: Record<string, { allowedRoles: Role[]; nextStatus: ApplicationStatus; allowedDecisions: ReviewDecision[] }> = {
  [ApplicationStatus.SUBMITTED]: {
    allowedRoles: [Role.HOD],
    nextStatus: ApplicationStatus.HOD_REVIEWED, // Default next status
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED, ReviewDecision.REVERTED],
  },
  [ApplicationStatus.REVIEWER_ASSIGNED]: {
    allowedRoles: [Role.REVIEWER],
    nextStatus: ApplicationStatus.CHAIRMAN_ASSIGNED, // Automatically moves to Chairman Reviewer
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED],
  },
  [ApplicationStatus.CHAIRMAN_ASSIGNED]: {
    allowedRoles: [Role.CHAIRMAN_REVIEWER],
    nextStatus: ApplicationStatus.CHAIRMAN_REVIEWED,
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED],
  },
  [ApplicationStatus.CHAIRMAN_REVIEWED]: {
    allowedRoles: [Role.PRINCIPAL],
    nextStatus: ApplicationStatus.PRINCIPAL_REVIEWED,
    allowedDecisions: [ReviewDecision.APPROVED, ReviewDecision.REJECTED],
  },
  [ApplicationStatus.REVIEWER_REVIEWED]: {
    allowedRoles: [Role.CHAIRMAN_REVIEWER, Role.PRINCIPAL],
    nextStatus: ApplicationStatus.CHAIRMAN_REVIEWED,
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED, ReviewDecision.APPROVED, ReviewDecision.REJECTED],
  },
};

// ─── POST /api/reviews/upload-signature — Upload signature image ────────────

router.post('/upload-signature', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('No signature file provided');

    const fs = await import('fs');
    const path = await import('path');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = req.file.originalname.split('.').pop() || 'png';
    const storageFilename = `${uniqueSuffix}.${ext}`;
    
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'signatures');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localFilePath = path.join(uploadDir, storageFilename);
    fs.writeFileSync(localFilePath, req.file.buffer);

    const publicUrl = `/uploads/signatures/${storageFilename}`;

    res.json({
      success: true,
      data: { file_path: publicUrl }
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/reviews/:applicationId — Submit a review ──────────────────────

router.post('/:applicationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, comments, reviewer_score, final_score, signature_path } = reviewSchema.parse(req.body);
    const user = req.user!;

    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId as string },
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
      if ((application as any).faculty.department_id !== user.department_id) {
        throw new ForbiddenError('Cannot review applications outside your department');
      }
    }
    if (user.role === Role.REVIEWER) {
      if (application.reviewer_id !== user.id) {
        throw new ForbiddenError('This application is not assigned to you');
      }
    }
    if (user.role === Role.CHAIRMAN_REVIEWER) {
      if (application.chairman_id && application.chairman_id !== user.id) {
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
        signature_path: signature_path || null,
      },
    });

    // Update application status and reviewer_score if provided
    let finalNextStatus = transition.nextStatus;
    if (decision === 'REVERTED') {
      finalNextStatus = 'REVERTED' as ApplicationStatus;
    } else if (application.status === ApplicationStatus.REVIEWER_REVIEWED && user.role === Role.PRINCIPAL) {
      finalNextStatus = ApplicationStatus.PRINCIPAL_REVIEWED;
    }

    const updateData: any = { status: finalNextStatus };
    let assignedChairman: any = null;

    if (user.role === Role.REVIEWER) {
      if (reviewer_score !== undefined && reviewer_score !== null) {
        const rounded = Number(Number(reviewer_score).toFixed(1));
        updateData.reviewer_score = rounded;
        updateData.final_score = rounded;
      } else if (application.reviewer_score !== null) {
        updateData.final_score = application.reviewer_score;
      } else {
        updateData.reviewer_score = application.total_score;
        updateData.final_score = application.total_score;
      }

      // Automatically forward to Chairman Reviewer
      finalNextStatus = ApplicationStatus.CHAIRMAN_ASSIGNED;
      updateData.status = finalNextStatus;

      if (application.chairman_id) {
        assignedChairman = await prisma.user.findUnique({
          where: { id: application.chairman_id },
        });
      } else {
        // Auto-assign active Chairman Reviewer (excluding faculty applicant)
        const candidates = await prisma.user.findMany({
          where: {
            role: Role.CHAIRMAN_REVIEWER,
            is_active: true,
            id: { not: application.faculty_id },
          },
          include: {
            _count: { select: { assigned_chairman_reviews: true } },
          },
          orderBy: { created_at: 'asc' },
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => a._count.assigned_chairman_reviews - b._count.assigned_chairman_reviews);
          assignedChairman = candidates[0];
        }
      }

      if (assignedChairman) {
        updateData.chairman_id = assignedChairman.id;
      }
    } else if (user.role === Role.CHAIRMAN_REVIEWER) {
      if (!application.chairman_id) {
        updateData.chairman_id = user.id;
      }
      if (final_score !== undefined && final_score !== null) {
        updateData.final_score = Number(Number(final_score).toFixed(1));
      } else if (reviewer_score !== undefined && reviewer_score !== null) {
        updateData.final_score = Number(Number(reviewer_score).toFixed(1));
      }
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: updateData,
    });

    // If auto-forwarded to Chairman Reviewer, log audit trail and notify Chairman Reviewer
    if (user.role === Role.REVIEWER && assignedChairman) {
      await prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: AuditAction.CHAIRMAN_ASSIGNED,
          entity_type: 'Application',
          entity_id: application.id,
          details: {
            chairman_id: assignedChairman.id,
            chairman_name: assignedChairman.name,
            auto_forwarded: true,
          },
        },
      });

      const subject = `New Application Auto-Forwarded for Chairman Review`;
      const body = `Dear ${assignedChairman.name},<br><br>
The peer review for faculty appraisal has been completed and automatically forwarded to you for Chairman Review for the academic year ${application.academic_year}.<br>
Please access your dashboard to complete the review.`;

      sendEmail(assignedChairman.email, subject, body).catch(e => console.error("Failed to send chairman email", e));
    }

    // Audit log
    const actionMap: Record<string, AuditAction> = {
      [Role.HOD]: AuditAction.APPLICATION_HOD_REVIEWED,
      [Role.REVIEWER]: AuditAction.APPLICATION_REVIEWER_REVIEWED,
      [Role.CHAIRMAN_REVIEWER]: AuditAction.APPLICATION_CHAIRMAN_REVIEWED,
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
          to_status: finalNextStatus,
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

// ─── PUT /api/reviews/:applicationId/entry/:categoryId/score — Update reviewer score ──

router.put('/:applicationId/entry/:categoryId/score', authorize(Role.REVIEWER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = req.params.applicationId as string;
    const categoryId = req.params.categoryId as string;
    const { reviewer_score } = req.body;
    const user = req.user!;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { category_entries: { include: { category: true } } },
    });

    if (!application) throw new NotFoundError('Application');
    if (application.reviewer_id !== user.id) throw new ForbiddenError('This application is not assigned to you');
    if (application.status !== 'REVIEWER_ASSIGNED') throw new ValidationError('Application is not in REVIEWER_ASSIGNED status');

    const entry = await prisma.categoryEntry.findUnique({
      where: { application_id_category_id: { application_id: applicationId, category_id: categoryId } },
    });

    if (!entry) throw new NotFoundError('Category Entry');

    const newScore = reviewer_score === '' || reviewer_score === null ? null : Number(reviewer_score);

    // Update the entry
    await prisma.categoryEntry.update({
      where: { id: entry.id },
      data: { reviewer_score: newScore },
    });

    // Recalculate total_score — scores are purely additive, no caps
    const allEntries = await prisma.categoryEntry.findMany({
      where: { application_id: applicationId },
    });

    const sectionTotals = { teaching: 0, research: 0, service: 0 };
    
    for (const e of allEntries) {
      const val = Number(e.reviewer_score !== null ? e.reviewer_score : e.calculated_score);
      
      const category = (application as any).category_entries.find((x: any) => x.id === e.id)?.category;
      if (category) {
        if (category.section === 'TEACHING') sectionTotals.teaching += val;
        else if (category.section === 'RESEARCH') sectionTotals.research += val;
        else if (category.section === 'SERVICE') sectionTotals.service += val;
      }
    }

    // No caps — section base values are multipliers, not ceilings
    const newTotal = Number((sectionTotals.teaching + sectionTotals.research + sectionTotals.service).toFixed(1));

    // Update application total
    const updatedApp = await prisma.application.update({
      where: { id: applicationId },
      data: { final_score: newTotal, reviewer_score: newTotal },
    });

    res.json({
      success: true,
      message: 'Reviewer score updated',
      data: {
        total_score: updatedApp.total_score,
        reviewer_score: updatedApp.reviewer_score,
        final_score: updatedApp.final_score,
        section_scores: sectionTotals
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/reviews/:applicationId/score — Update overall application reviewer score ──

router.put('/:applicationId/score', authorize(Role.REVIEWER, Role.CHAIRMAN_REVIEWER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = req.params.applicationId as string;
    const { reviewer_score, final_score } = req.body;
    const user = req.user!;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) throw new NotFoundError('Application');
    if (user.role === Role.REVIEWER && application.reviewer_id !== user.id) {
      throw new ForbiddenError('This application is not assigned to you');
    }
    if (user.role === Role.CHAIRMAN_REVIEWER && application.chairman_id && application.chairman_id !== user.id) {
      throw new ForbiddenError('This application is not assigned to you');
    }

    const effectiveScore = final_score !== undefined && final_score !== null && final_score !== ''
      ? Number(Number(final_score).toFixed(1))
      : (reviewer_score !== undefined && reviewer_score !== null && reviewer_score !== ''
          ? Number(Number(reviewer_score).toFixed(1))
          : null);

    const updateData: any = {};
    if (user.role === Role.CHAIRMAN_REVIEWER) {
      if (effectiveScore !== null) {
        updateData.final_score = effectiveScore;
      }
      if (!application.chairman_id) {
        updateData.chairman_id = user.id;
      }
    } else {
      updateData.reviewer_score = effectiveScore;
      updateData.final_score = effectiveScore !== null ? effectiveScore : application.total_score;
    }

    const updatedApp = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
    });

    res.json({
      success: true,
      message: user.role === Role.CHAIRMAN_REVIEWER ? 'Finalized score updated' : 'Reviewer score updated',
      data: {
        total_score: updatedApp.total_score,
        reviewer_score: updatedApp.reviewer_score,
        final_score: updatedApp.final_score,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/reviews/:applicationId — Get reviews for an application ────────

router.get('/:applicationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = req.params.applicationId as string;
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundError('Application');

    const reviews = await prisma.review.findMany({
      where: { application_id: applicationId },
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
