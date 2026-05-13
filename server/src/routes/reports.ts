import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import { generateAppraisalPDF, generateConsolidatedPDF, generateExcelReport } from '../lib/reportGenerator.js';

const router = Router();
router.use(authenticate);

// ─── GET /api/reports/appraisal/:id/pdf — Download individual appraisal PDF ──

router.get(
  '/appraisal/:id/pdf',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const application = await prisma.application.findUnique({
        where: { id: req.params.id },
        include: { faculty: { select: { id: true, department_id: true } } },
      });

      if (!application) throw new NotFoundError('Application');

      // Access control: Faculty can only download their own
      if (user.role === Role.FACULTY && application.faculty.id !== user.id) {
        throw new ForbiddenError('Cannot download another faculty\'s report');
      }
      if (user.role === Role.HOD && application.faculty.department_id !== user.department_id) {
        throw new ForbiddenError('Cannot access application outside your department');
      }

      const pdfStream = await generateAppraisalPDF(application.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="appraisal_${application.academic_year}_${req.params.id.slice(0, 8)}.pdf"`);

      pdfStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/reports/consolidated/pdf — Download consolidated report PDF ─────

router.get(
  '/consolidated/pdf',
  authorize(Role.ADMIN, Role.PRINCIPAL, Role.ACCOUNTS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academic_year, department_id } = req.query;

      const pdfStream = await generateConsolidatedPDF({
        academic_year: academic_year as string | undefined,
        department_id: department_id as string | undefined,
      });

      const filename = `consolidated_report${academic_year ? `_${academic_year}` : ''}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      pdfStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/reports/consolidated/excel — Download Excel report ──────────────

router.get(
  '/consolidated/excel',
  authorize(Role.ADMIN, Role.PRINCIPAL, Role.ACCOUNTS),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academic_year, department_id } = req.query;

      const workbook = await generateExcelReport({
        academic_year: academic_year as string | undefined,
        department_id: department_id as string | undefined,
      });

      const filename = `appraisal_report${academic_year ? `_${academic_year}` : ''}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
