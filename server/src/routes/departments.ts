import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/departments ─────────────────────────────────────────────────────
// Public for login form dropdown, but also used internally
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });

    res.json({ success: true, data: { departments } });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/departments/:id ─────────────────────────────────────────────────

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          where: { is_active: true },
          select: { id: true, name: true, email: true, role: true, designation: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    res.json({ success: true, data: { department } });
  } catch (error) {
    next(error);
  }
});

export default router;
