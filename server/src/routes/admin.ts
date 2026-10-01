import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationStatus, AuditAction, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';
import { sendEmail } from '../lib/email.js';

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

    const subject = `New Application Assigned for Review`;
    const body = `Dear ${reviewer.name},<br><br>
An application has been assigned to you by the Admin for the academic year ${application.academic_year}.<br>
You have this application to be reviewed in your dashboard.`;
    
    // Fire and forget email to avoid slowing down API response
    sendEmail(reviewer.email, subject, body).catch(e => console.error("Failed to send reviewer email", e));

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
      data: {
        status: ApplicationStatus.FROZEN,
        frozen_at: new Date()
      },
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

// ─── GET /api/admin/approvals-rejections — View principal decisions ───────────

router.get('/approvals-rejections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const principalReviews = await prisma.review.findMany({
      where: { role_at_review: Role.PRINCIPAL },
      include: {
        application: {
          include: {
            faculty: {
              include: { department: true }
            }
          }
        }
      },
      orderBy: { reviewed_at: 'desc' }
    });

    const seenApplicationIds = new Set<string>();
    const uniqueReviews: typeof principalReviews = [];
    for (const r of principalReviews) {
      if (!seenApplicationIds.has(r.application_id)) {
        seenApplicationIds.add(r.application_id);
        uniqueReviews.push(r);
      }
    }

    const applications = uniqueReviews.map(r => ({
      id: r.application.id,
      faculty: {
        name: r.application.faculty.name,
        email: r.application.faculty.email,
        department: r.application.faculty.department ? { code: r.application.faculty.department.code } : null
      },
      academic_year: r.application.academic_year,
      final_score: r.application.final_score,
      decision: r.decision,
      comments: r.comments,
      reviewed_at: r.reviewed_at
    }));

    res.json({ success: true, data: { applications } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/override-application/:facultyId — Force open app ──────

router.post('/override-application/:facultyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty_id = req.params.facultyId as string;
    const academic_year = req.body.academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    const existing = await prisma.application.findUnique({
      where: { faculty_id_academic_year: { faculty_id, academic_year } },
    });
    
    const action = req.body.action; // 'EDIT' or 'OPEN'

    if (existing) {
      if (action === 'OPEN') {
        return res.status(400).json({ success: false, error: 'Application for this year is already open or exists.' });
      }
      if (existing.status !== 'DRAFT') {
        // Force change to DRAFT to allow editing, and clear reviewer assignments and scores
        const updated = await prisma.application.update({
          where: { id: existing.id },
          data: {
            status: 'DRAFT',
            reviewer_id: null,
            reviewer_score: null,
          }
        });
        
        await prisma.categoryEntry.updateMany({
          where: { application_id: existing.id },
          data: { reviewer_score: null }
        });

        return res.json({ success: true, message: 'Existing application forced to DRAFT mode.', data: { application: updated } });
      }
      return res.json({ success: true, message: 'Application is already open for editing.', data: { application: existing } });
    }

    if (action === 'EDIT') {
      return res.status(404).json({ success: false, error: 'No application exists for this year to edit.' });
    }

    const application = await prisma.application.create({
      data: { faculty_id, academic_year, status: 'DRAFT' },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.APPLICATION_CREATED,
        entity_type: 'Application',
        entity_id: application.id,
        details: { action: 'admin_override', academic_year },
      },
    });

    res.status(201).json({ success: true, message: 'New application forcefully opened.', data: { application } });
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

// ─── PUT /api/admin/scoring-categories/:id — Update category ─────────

const updateCategorySchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  input_config: z.any().optional(),
  scoring_rules: z.array(z.object({
    id: z.string(),
    max_weightage: z.number().or(z.string()),
    formula: z.any()
  })).optional()
});

router.put('/scoring-categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, is_active, input_config, scoring_rules } = updateCategorySchema.parse(req.body);

    const category = await prisma.scoringCategory.update({
      where: { id: req.params.id as string },
      data: { name, description, is_active, input_config: input_config === undefined ? undefined : input_config },
    });

    if (scoring_rules) {
      for (const rule of scoring_rules) {
        await prisma.scoringRule.update({
          where: { id: rule.id },
          data: { max_weightage: rule.max_weightage, formula: rule.formula },
        });
      }
    }

    res.json({ success: true, message: 'Category updated successfully', data: { category } });
  } catch (error) {
    next(error);
  }
});

// ─── Default Categories and Formulas Metadata ──────────────────────────────
const DEFAULT_CATEGORIES_METADATA: Record<number, any> = {
  1: { section: 'TEACHING', name: 'FCI Score', description: 'Average FCI Score of all courses handled (percentage)', input_type: 'percentage', input_config: { max_attachments: 1, field: 'fci_percentage' } },
  2: { section: 'RESEARCH', name: 'Non-paid Refereed Journal Papers in SJR/Scopus/Web of Science', description: 'Faculty must be one among first 3 authors. 1 paper = 100% of research weightage.', input_type: 'number', input_config: { max_attachments: 2, field: 'count' } },
  3: { section: 'RESEARCH', name: 'Indexed Conference Papers in SJR/Scopus/Web of Science', description: 'Faculty must be one among first 3 authors. Designation-based scoring per paper.', input_type: 'number', input_config: { max_attachments: 2, field: 'count' } },
  4: { section: 'RESEARCH', name: 'Non-paid Non-refereed Journals and Non-indexed Conferences', description: 'Faculty must be one among first 3 authors. 10% of research weightage.', input_type: 'number', input_config: { max_attachments: 2, field: 'count' } },
  5: { section: 'RESEARCH', name: 'Books/Chapters', description: 'Faculty must be one among first 3 authors. 1 book = 50%, 1 chapter = 20%.', input_type: 'composite', input_config: { max_attachments: 1, fields: ['books', 'chapters'] } },
  6: { section: 'RESEARCH', name: 'Disclosures Filed', description: '1 disclosure = 10% of research weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  7: { section: 'RESEARCH', name: 'Patents Granted', description: '1 patent = 50% of research weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  8: { section: 'RESEARCH', name: 'Research Guidance UG', description: '1 batch = 1% of research weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  9: { section: 'RESEARCH', name: 'Research Guidance PG', description: '1 batch = 3% of research weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  10: { section: 'RESEARCH', name: 'Research Guidance PhD', description: '1 batch = 7% of research weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  11: { section: 'RESEARCH', name: 'Funded Projects', description: 'Slab-based: ≥10L=100%, ≥5L=50%, ≥1L=30%, <1L=20% of research weightage.', input_type: 'currency_slab', input_config: { max_attachments: 1, field: 'amount_lakhs' } },
  12: { section: 'RESEARCH', name: 'Consulting Projects', description: 'Slab-based: ≥10L=100%, ≥5L=60%, ≥1L=50%, <1L=20% of research weightage.', input_type: 'currency_slab', input_config: { max_attachments: 1, field: 'amount_lakhs' } },
  13: { section: 'SERVICE', name: 'Conference Chair, Session Chair, Reviewer of Q1/Q2 Journal', description: '5% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  14: { section: 'SERVICE', name: 'FDP/Seminar/Workshop organized as coordinator', description: '5 days = 10%, 3 days = 5% of service weightage.', input_type: 'days_slab', input_config: { max_attachments: 1, field: 'days' } },
  15: { section: 'SERVICE', name: 'Invited Technical Talks outside the Institute', description: '10% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  16: { section: 'SERVICE', name: 'Events Participated Outside Institute (FDP/Seminar/Workshop/Conference)', description: '10% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  17: { section: 'SERVICE', name: 'Events Participated Inside Institute (FDP/Seminar/Workshop/Conference)', description: '5% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  18: { section: 'SERVICE', name: 'Industry Relations (MoU, Co-hosted event, Technical Talk Series)', description: '10% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  19: { section: 'SERVICE', name: 'Institutional/Departmental Services (NBA/NIRF)', description: 'Coordinator = 20%, Others = 5% of service weightage.', input_type: 'role_select', input_config: { max_attachments: 1, field: 'role', options: ['coordinator', 'member'] } },
  20: { section: 'SERVICE', name: 'Other Services to Institution or Society Contribution', description: '3% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  21: { section: 'SERVICE', name: 'Awards and Honours', description: '1 event = 15% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  22: { section: 'SERVICE', name: 'Professionalism / Team Spirit', description: '2% of service weightage.', input_type: 'number', input_config: { max_attachments: 1, field: 'count' } },
  23: { section: 'SERVICE', name: 'Any Other Major Contributions', description: 'Free text (max 500 characters), no automatic scoring.', input_type: 'text', input_config: { max_attachments: 1, field: 'description', max_chars: 500 } },
};

const DEFAULT_FORMULAS_BY_SL: Record<number, any> = {
  1:  { type: 'fci_slab', slabs: [{ min: 85, pct: 100 }, { min: 80, pct: 90 }, { min: 75, pct: 80 }, { min: 70, pct: 70 }, { min: 0, pct: 40 }] },
  2:  { type: 'count_threshold', pct_per_item: 100, description: '1 paper = 100% of research weightage' },
  3:  { type: 'designation_based', ASSISTANT_PROFESSOR: 50, ASSOCIATE_PROFESSOR: 25, PROFESSOR: 20, description: 'pct per paper varies by designation' },
  4:  { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
  5:  { type: 'composite', book_pct: 50, chapter_pct: 20, description: '1 book=50%, 1 chapter=20%' },
  6:  { type: 'count_pct', pct_per_item: 10, description: '1 disclosure = 10%' },
  7:  { type: 'count_pct', pct_per_item: 50, description: '1 patent = 50%' },
  8:  { type: 'count_pct', pct_per_item: 1, description: '1 batch = 1%' },
  9:  { type: 'count_pct', pct_per_item: 3, description: '1 batch = 3%' },
  10: { type: 'count_pct', pct_per_item: 7, description: '1 batch = 7%' },
  11: { type: 'currency_slab', slabs: [{ min: 10, pct: 100 }, { min: 5, pct: 50 }, { min: 1, pct: 30 }, { min: 0, pct: 20 }] },
  12: { type: 'currency_slab', slabs: [{ min: 10, pct: 100 }, { min: 5, pct: 60 }, { min: 1, pct: 50 }, { min: 0, pct: 20 }] },
  13: { type: 'count_threshold', pct_if_any: 5, description: '5% if count > 0' },
  14: { type: 'days_slab', slabs: [{ min: 5, pct: 10 }, { min: 3, pct: 5 }] },
  15: { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
  16: { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
  17: { type: 'count_threshold', pct_if_any: 5, description: '5% if count > 0' },
  18: { type: 'count_threshold', pct_if_any: 10, description: '10% if count > 0' },
  19: { type: 'role_based', coordinator_pct: 20, member_pct: 5 },
  20: { type: 'count_threshold', pct_if_any: 3, description: '3% if count > 0' },
  21: { type: 'count_pct', pct_per_item: 15, description: '1 event = 15%' },
  22: { type: 'count_threshold', pct_if_any: 2, description: '2% if count > 0' },
  23: { type: 'free_text', pct: 0, description: 'No automatic scoring' },
};

const DEFAULT_SECTION_MAXES: Record<string, Record<string, number>> = {
  TEACHING: { ASSISTANT_PROFESSOR: 60, ASSOCIATE_PROFESSOR: 50, PROFESSOR: 40 },
  RESEARCH: { ASSISTANT_PROFESSOR: 10, ASSOCIATE_PROFESSOR: 20, PROFESSOR: 30 },
  SERVICE:  { ASSISTANT_PROFESSOR: 30, ASSOCIATE_PROFESSOR: 30, PROFESSOR: 30 },
};

// ─── POST /api/admin/scoring-categories/:id/reset-default — Revert category to default ────
router.post('/scoring-categories/:id/reset-default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const catId = req.params.id as string;
    const cat = await prisma.scoringCategory.findUnique({
      where: { id: catId },
      include: { scoring_rules: true }
    });

    if (!cat) throw new NotFoundError('Scoring Category');

    const meta = DEFAULT_CATEGORIES_METADATA[cat.sl_no];
    if (!meta) throw new ValidationError('No default metadata found for category sl_no ' + cat.sl_no);

    const updatedCat = await prisma.scoringCategory.update({
      where: { id: catId },
      data: {
        name: meta.name,
        description: meta.description,
        is_active: true,
        input_config: meta.input_config,
      }
    });

    const formula = DEFAULT_FORMULAS_BY_SL[cat.sl_no] || {};
    const sectionMax = DEFAULT_SECTION_MAXES[meta.section] || {};

    for (const rule of cat.scoring_rules) {
      const defaultMax = sectionMax[rule.designation] || 30;
      await prisma.scoringRule.update({
        where: { id: rule.id },
        data: {
          max_weightage: defaultMax,
          formula: formula
        }
      });
    }

    res.json({
      success: true,
      message: `Category SL #${cat.sl_no} (${meta.name}) reverted to system default`,
      data: { category: updatedCat }
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/admin/scoring-categories/reset-defaults — Revert ALL categories to default ───
router.post('/scoring-categories/reset-defaults', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allCategories = await prisma.scoringCategory.findMany({
      include: { scoring_rules: true }
    });

    for (const cat of allCategories) {
      const meta = DEFAULT_CATEGORIES_METADATA[cat.sl_no];
      if (!meta) continue;

      await prisma.scoringCategory.update({
        where: { id: cat.id },
        data: {
          name: meta.name,
          description: meta.description,
          is_active: true,
          input_config: meta.input_config,
        }
      });

      const formula = DEFAULT_FORMULAS_BY_SL[cat.sl_no] || {};
      const sectionMax = DEFAULT_SECTION_MAXES[meta.section] || {};

      for (const rule of cat.scoring_rules) {
        const defaultMax = sectionMax[rule.designation] || 30;
        await prisma.scoringRule.update({
          where: { id: rule.id },
          data: {
            max_weightage: defaultMax,
            formula: formula
          }
        });
      }
    }

    res.json({
      success: true,
      message: 'All scoring categories and rules reverted to system defaults successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
