import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationStatus, AuditAction, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';
import { calculateApplicationScores } from '../lib/scoreEngine.js';
import upload from '../lib/upload.js';

const router = Router();
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────────────────

const createAppSchema = z.object({
  academic_year: z.string().regex(/^\d{4}-\d{4}$/, 'Format: YYYY-YYYY'),
});

const saveCategorySchema = z.object({
  category_id: z.string(),
  raw_value: z.record(z.any()),
});

// ─── GET /api/applications — List applications ───────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, department_id, academic_year, page = '1', limit = '20' } = req.query;
    const user = req.user!;
    const where: any = {};

    // Role-based filtering
    if (user.role === Role.FACULTY) {
      where.faculty_id = user.id;
    } else if (user.role === Role.HOD) {
      where.faculty = { department_id: user.department_id };
      if (!status) where.status = { not: ApplicationStatus.DRAFT };
    } else if (user.role === Role.REVIEWER) {
      where.reviewer_id = user.id;
      where.status = { in: [ApplicationStatus.REVIEWER_ASSIGNED, ApplicationStatus.REVIEWER_REVIEWED] };
    } else if (user.role === Role.PRINCIPAL) {
      where.status = { in: [ApplicationStatus.REVIEWER_REVIEWED, ApplicationStatus.PRINCIPAL_REVIEWED, ApplicationStatus.FROZEN] };
    } else if (user.role === Role.ACCOUNTS) {
      where.status = ApplicationStatus.SENT_TO_ACCOUNTS;
    }
    // ADMIN sees all

    if (status) where.status = status;
    if (department_id) where.faculty = { ...where.faculty, department_id };
    if (academic_year) where.academic_year = academic_year;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          faculty: {
            select: { id: true, name: true, email: true, designation: true, department: { select: { id: true, name: true, code: true } } },
          },
          reviewer: { select: { id: true, name: true } },
          _count: { select: { category_entries: true, reviews: true } },
        },
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        applications,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/applications — Create new application ─────────────────────────

router.post('/', authorize(Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { academic_year } = createAppSchema.parse(req.body);

    const existing = await prisma.application.findUnique({
      where: { faculty_id_academic_year: { faculty_id: req.user!.id, academic_year } },
    });
    if (existing) throw new ValidationError(`Application for ${academic_year} already exists`);

    const application = await prisma.application.create({
      data: { faculty_id: req.user!.id, academic_year },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.APPLICATION_CREATED,
        entity_type: 'Application',
        entity_id: application.id,
        details: { academic_year },
      },
    });

    res.status(201).json({ success: true, data: { application } });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/applications/categories/list — List scoring categories (all users)

router.get('/categories/list', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.scoringCategory.findMany({
      orderBy: { sl_no: 'asc' },
      select: { id: true, sl_no: true, section: true, name: true, description: true, input_type: true, input_config: true },
    });

    res.json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/applications/:id — Get application detail ──────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        faculty: {
          select: { id: true, name: true, email: true, designation: true, department: { select: { id: true, name: true, code: true } } },
        },
        reviewer: { select: { id: true, name: true, email: true } },
        category_entries: {
          include: {
            category: { select: { id: true, sl_no: true, section: true, name: true, input_type: true, description: true, input_config: true } },
            proof_documents: true,
          },
          orderBy: { category: { sl_no: 'asc' } },
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, role: true } } },
          orderBy: { reviewed_at: 'asc' },
        },
      },
    });

    if (!application) throw new NotFoundError('Application');

    // Access control
    const user = req.user!;
    if (user.role === Role.FACULTY && application.faculty_id !== user.id) {
      throw new ForbiddenError('Cannot access another faculty\'s application');
    }
    if (user.role === Role.HOD && application.faculty.department.id !== user.department_id) {
      throw new ForbiddenError('Cannot access application outside your department');
    }
    if (user.role === Role.REVIEWER && application.reviewer_id !== user.id) {
      throw new ForbiddenError('This application is not assigned to you');
    }

    res.json({ success: true, data: { application } });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/applications/:id/entry — Save a category entry ─────────────────

router.put('/:id/entry', authorize(Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category_id, raw_value } = saveCategorySchema.parse(req.body);

    const application = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!application) throw new NotFoundError('Application');
    if (application.faculty_id !== req.user!.id) throw new ForbiddenError();
    if (application.status !== ApplicationStatus.DRAFT) throw new ValidationError('Cannot edit a submitted application');

    const entry = await prisma.categoryEntry.upsert({
      where: { application_id_category_id: { application_id: application.id, category_id } },
      update: { raw_value },
      create: { application_id: application.id, category_id, raw_value },
    });

    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/applications/:id/upload/:categoryId — Upload proof ─────────────

router.post('/:id/upload/:categoryId', authorize(Role.FACULTY), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('No file uploaded');

    const application = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!application) throw new NotFoundError('Application');
    if (application.faculty_id !== req.user!.id) throw new ForbiddenError();
    if (application.status !== ApplicationStatus.DRAFT) throw new ValidationError('Cannot upload to a submitted application');

    // Ensure category entry exists
    let entry = await prisma.categoryEntry.findUnique({
      where: { application_id_category_id: { application_id: application.id, category_id: req.params.categoryId } },
    });
    if (!entry) {
      entry = await prisma.categoryEntry.create({
        data: { application_id: application.id, category_id: req.params.categoryId, raw_value: {} },
      });
    }

    const doc = await prisma.proofDocument.create({
      data: {
        category_entry_id: entry.id,
        file_name: req.file.originalname,
        file_path: req.file.path,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.FILE_UPLOADED,
        entity_type: 'ProofDocument',
        entity_id: doc.id,
        details: { filename: req.file.originalname, category_id: req.params.categoryId },
      },
    });

    res.status(201).json({ success: true, data: { document: doc } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/applications/:id/submit — Submit application ──────────────────

router.post('/:id/submit', authorize(Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { faculty: { select: { designation: true } } },
    });

    if (!application) throw new NotFoundError('Application');
    if (application.faculty_id !== req.user!.id) throw new ForbiddenError();
    if (application.status !== ApplicationStatus.DRAFT) throw new ValidationError('Application already submitted');
    if (!application.faculty.designation) throw new ValidationError('Faculty designation is required for score calculation');

    // Calculate scores
    const { entries, totals } = await calculateApplicationScores(application.id, application.faculty.designation);

    // Update all category entry scores
    for (const entry of entries) {
      await prisma.categoryEntry.update({
        where: { application_id_category_id: { application_id: application.id, category_id: entry.category_id } },
        data: { calculated_score: entry.calculated_score },
      });
    }

    // Update application
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.SUBMITTED,
        total_score: totals.total,
        final_score: totals.total,
        submitted_at: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.id,
        action: AuditAction.APPLICATION_SUBMITTED,
        entity_type: 'Application',
        entity_id: application.id,
        details: { totals },
      },
    });

    res.json({ success: true, data: { application: updated, scores: totals } });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/applications/:id/score-preview — Preview scores ─────────────────

router.get('/:id/score-preview', authorize(Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { faculty: { select: { designation: true } } },
    });

    if (!application) throw new NotFoundError('Application');
    if (application.faculty_id !== req.user!.id) throw new ForbiddenError();
    if (!application.faculty.designation) throw new ValidationError('Designation required');

    const { entries, totals } = await calculateApplicationScores(application.id, application.faculty.designation);
    res.json({ success: true, data: { entries, totals } });
  } catch (error) {
    next(error);
  }
});

export default router;
