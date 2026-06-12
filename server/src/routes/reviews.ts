import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationStatus, AuditAction, ReviewDecision, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';
import { upload } from '../lib/upload.js';
import supabase from '../lib/supabase.js';

const router = Router();
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  decision: z.enum(['RECOMMENDED', 'NOT_RECOMMENDED', 'APPROVED', 'REJECTED', 'REVERTED']),
  comments: z.string().max(2000).optional(),
  reviewer_score: z.number().min(0).max(1000).optional(),
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
    nextStatus: ApplicationStatus.REVIEWER_REVIEWED,
    allowedDecisions: [ReviewDecision.RECOMMENDED, ReviewDecision.NOT_RECOMMENDED],
  },
  [ApplicationStatus.REVIEWER_REVIEWED]: {
    allowedRoles: [Role.PRINCIPAL],
    nextStatus: ApplicationStatus.PRINCIPAL_REVIEWED,
    allowedDecisions: [ReviewDecision.APPROVED, ReviewDecision.REJECTED],
  },
};

// ─── POST /api/reviews/upload-signature — Upload signature image ────────────

router.post('/upload-signature', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('No signature file provided');

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = req.file.originalname.split('.').pop() || 'png';
    const storageFilename = `signatures/${uniqueSuffix}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('proofs')
      .upload(storageFilename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw new Error('Failed to upload signature to cloud storage');
    }

    const { data: publicUrlData } = supabase.storage.from('proofs').getPublicUrl(storageFilename);
    const publicUrl = publicUrlData.publicUrl;

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
    const { decision, comments, reviewer_score, signature_path } = reviewSchema.parse(req.body);
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
    }

    const updateData: any = { status: finalNextStatus };
    if (user.role === Role.REVIEWER) {
      // If reviewer didn't explicitly edit individual entries, reviewer_score might be null.
      // Set it to match the total_score to indicate they accepted the system scores.
      if (application.reviewer_score === null) {
        updateData.reviewer_score = application.total_score;
      }
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: updateData,
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
    const newTotal = sectionTotals.teaching + sectionTotals.research + sectionTotals.service;

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
