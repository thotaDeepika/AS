import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ForbiddenError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/analytics - Comprehensive Appraisal Analytics Endpoint
 * Access: ADMIN, PRINCIPAL, HOD
 * Data Scoping:
 * - HOD: Strictly restricted to their own department (user.department_id)
 * - PRINCIPAL / ADMIN: Access to all departments with filtering support
 */
router.get('/', authorize(Role.ADMIN, Role.PRINCIPAL, Role.HOD), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { academic_year, designation, status } = req.query;
    let department_id = req.query.department_id as string | undefined;

    // Strict role scoping for HOD
    if (user.role === Role.HOD) {
      if (!user.department_id) {
        throw new ForbiddenError('HOD is not assigned to any department');
      }
      department_id = user.department_id; // Overwrite filter to force HOD's department
    }

    // Build base Prisma filter condition for Applications
    const appWhere: any = {};

    if (academic_year && academic_year !== 'ALL') {
      appWhere.academic_year = String(academic_year);
    }

    if (status && status !== 'ALL') {
      const sStr = String(status);
      if (sStr === 'IN_REVIEW') {
        appWhere.status = { in: ['HOD_REVIEWED', 'REVIEWER_ASSIGNED', 'REVIEWER_REVIEWED'] };
      } else if (sStr === 'APPROVED') {
        appWhere.status = { in: ['PRINCIPAL_REVIEWED', 'FROZEN', 'SENT_TO_ACCOUNTS'] };
      } else {
        appWhere.status = sStr;
      }
    }

    const facultyWhere: any = {};
    if (department_id && department_id !== 'ALL') {
      facultyWhere.department_id = String(department_id);
    }
    if (designation && designation !== 'ALL') {
      facultyWhere.designation = String(designation);
    }

    if (Object.keys(facultyWhere).length > 0) {
      appWhere.faculty = facultyWhere;
    }

    // Fetch matching applications with relations
    const applications = await prisma.application.findMany({
      where: appWhere,
      include: {
        faculty: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            department: {
              select: { id: true, name: true, code: true }
            }
          }
        },
        category_entries: {
          include: {
            category: {
              select: { sl_no: true, section: true, name: true }
            }
          }
        }
      }
    });

    // Fetch list of departments and academic years for filters
    const [allDepartments, distinctYears] = await Promise.all([
      prisma.department.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' }
      }),
      prisma.application.findMany({
        select: { academic_year: true },
        distinct: ['academic_year'],
        orderBy: { academic_year: 'desc' }
      })
    ]);

    const availableYears = distinctYears.map(y => y.academic_year);
    const availableDepartments = user.role === Role.HOD
      ? allDepartments.filter(d => d.id === user.department_id)
      : allDepartments;

    // If no applications found, return zeroed statistics structure
    if (applications.length === 0) {
      return res.json({
        success: true,
        data: {
          filters: {
            availableYears,
            availableDepartments,
            userRole: user.role,
            appliedDepartmentId: department_id || 'ALL'
          },
          summary: {
            totalApplications: 0,
            avgTeaching: 0,
            avgResearch: 0,
            avgService: 0,
            avgTotalScore: 0,
            avgBonusScore: 0,
            avgFinalScore: 0,
            maxFinalScore: 0,
            minFinalScore: 0,
            totalJournals: 0,
            totalPatents: 0,
            totalFunded: 0
          },
          scoreDistribution: [],
          sectionRadar: [],
          departmentComparison: [],
          designationComparison: [],
          yearOverYearTrend: [],
          topPerformers: []
        }
      });
    }

    // ── 1. Calculate Summary Metrics ──────────────────────────────────────────
    let sumTeaching = 0;
    let sumResearch = 0;
    let sumService = 0;
    let sumTotal = 0;
    let sumBonus = 0;
    let sumFinal = 0;

    let maxFinalScore = -Infinity;
    let minFinalScore = Infinity;

    let totalJournals = 0;
    let totalPatents = 0;
    let totalFunded = 0;

    // Distribution counters
    const distributionBuckets = {
      under50: 0,
      b50to65: 0,
      b65to80: 0,
      b80to95: 0,
      b95to100: 0,
      over100Bonus: 0
    };

    // Department grouping accumulator
    const deptMap: Record<string, { name: string; code: string; count: number; teaching: number; research: number; service: number; total: number; bonus: number; finalScore: number }> = {};

    // Designation grouping accumulator
    const desigMap: Record<string, { count: number; teaching: number; research: number; service: number; total: number; bonus: number; finalScore: number }> = {
      ASSISTANT_PROFESSOR: { count: 0, teaching: 0, research: 0, service: 0, total: 0, bonus: 0, finalScore: 0 },
      ASSOCIATE_PROFESSOR: { count: 0, teaching: 0, research: 0, service: 0, total: 0, bonus: 0, finalScore: 0 },
      PROFESSOR:           { count: 0, teaching: 0, research: 0, service: 0, total: 0, bonus: 0, finalScore: 0 },
      HEAD:                { count: 0, teaching: 0, research: 0, service: 0, total: 0, bonus: 0, finalScore: 0 }
    };

    // Process each application
    applications.forEach(app => {
      let appTeaching = 0;
      let appRegResearch = 0;
      let appBonusResearch = 0;
      let appService = 0;

      app.category_entries.forEach(e => {
        const score = Number(e.calculated_score || 0);
        const slNo = e.category?.sl_no;
        const section = e.category?.section;
        const val = e.raw_value as Record<string, any>;

        if (section === 'TEACHING') {
          appTeaching += score;
        } else if (section === 'RESEARCH') {
          if ([2, 7, 11, 12].includes(slNo)) {
            appBonusResearch += score;
          } else {
            appRegResearch += score;
          }

          // Count publications, patents, funded projects
          if (slNo === 2) totalJournals += Number(val.count || val.nirfJournals || 0);
          if (slNo === 7) totalPatents += Number(val.count || val.patentsGranted || 0);
          if (slNo === 11) {
            const f1 = Number(val.fundedProjects1 || val.tier1_count || 0);
            const f2 = Number(val.fundedProjects2 || val.tier2_count || 0);
            const f3 = Number(val.fundedProjects3 || val.tier3_count || 0);
            const f4 = Number(val.fundedProjects4 || val.tier4_count || 0);
            totalFunded += (f1 * 10) + (f2 * 7.5) + (f3 * 3) + (f4 * 0.5) + Number(val.amount_lakhs || 0);
          }
        } else if (section === 'SERVICE') {
          appService += score;
        }
      });

      // Legacy capping and bonus absorption logic
      const desig = app.faculty.designation || 'ASSISTANT_PROFESSOR';
      let maxTeaching = 60;
      let maxResearch = 10;
      let maxService = 30;

      if (desig.includes('ASSOCIATE')) {
        maxTeaching = 50; maxResearch = 20; maxService = 30;
      } else if (desig.includes('PROFESSOR') || desig.includes('HEAD')) {
        maxTeaching = 40; maxResearch = 30; maxService = 30;
      }

      const teachingScore = Math.min(appTeaching, maxTeaching);
      const serviceScore = Math.min(appService, maxService);

      let resScore = appRegResearch;
      let bonusScore = appBonusResearch;

      if ((resScore + bonusScore) <= maxResearch) {
        resScore = resScore + bonusScore;
        bonusScore = 0;
      } else if (resScore >= maxResearch) {
        resScore = maxResearch;
      } else {
        const deficit = maxResearch - resScore;
        resScore = maxResearch;
        bonusScore = bonusScore - deficit;
      }

      const totalScore = Math.min(teachingScore + serviceScore + resScore, 100);
      const finalScore = Number(app.final_score !== null && app.final_score !== undefined ? app.final_score : (totalScore + bonusScore));

      sumTeaching += teachingScore;
      sumResearch += resScore;
      sumService += serviceScore;
      sumTotal += totalScore;
      sumBonus += bonusScore;
      sumFinal += finalScore;

      if (finalScore > maxFinalScore) maxFinalScore = finalScore;
      if (finalScore < minFinalScore) minFinalScore = finalScore;

      // Distribution histogram
      if (finalScore < 50) distributionBuckets.under50++;
      else if (finalScore < 65) distributionBuckets.b50to65++;
      else if (finalScore < 80) distributionBuckets.b65to80++;
      else if (finalScore < 95) distributionBuckets.b80to95++;
      else if (finalScore <= 100) distributionBuckets.b95to100++;
      else distributionBuckets.over100Bonus++;

      // Accumulate for Department
      const deptName = app.faculty.department?.name || 'Unassigned';
      const deptCode = app.faculty.department?.code || 'OTH';
      const deptId = app.faculty.department?.id || 'unassigned';

      if (!deptMap[deptId]) {
        deptMap[deptId] = { name: deptName, code: deptCode, count: 0, teaching: 0, research: 0, service: 0, total: 0, bonus: 0, finalScore: 0 };
      }
      deptMap[deptId].count++;
      deptMap[deptId].teaching += teachingScore;
      deptMap[deptId].research += resScore;
      deptMap[deptId].service += serviceScore;
      deptMap[deptId].total += totalScore;
      deptMap[deptId].bonus += bonusScore;
      deptMap[deptId].finalScore += finalScore;

      // Accumulate for Designation
      const dKey = desigMap[desig] ? desig : 'ASSISTANT_PROFESSOR';
      desigMap[dKey].count++;
      desigMap[dKey].teaching += teachingScore;
      desigMap[dKey].research += resScore;
      desigMap[dKey].service += serviceScore;
      desigMap[dKey].total += totalScore;
      desigMap[dKey].bonus += bonusScore;
      desigMap[dKey].finalScore += finalScore;
    });

    const count = applications.length;

    // ── 2. Format Aggregated Data Output ──────────────────────────────────────

    // Score distribution array
    const scoreDistribution = [
      { band: '< 50', count: distributionBuckets.under50, color: '#ef4444' },
      { band: '50 - 64.9', count: distributionBuckets.b50to65, color: '#f97316' },
      { band: '65 - 79.9', count: distributionBuckets.b65to80, color: '#f59e0b' },
      { band: '80 - 94.9', count: distributionBuckets.b80to95, color: '#3b82f6' },
      { band: '95 - 100', count: distributionBuckets.b95to100, color: '#10b981' },
      { band: '> 100 (Bonus)', count: distributionBuckets.over100Bonus, color: '#ec4899' }
    ];

    // Department Comparison Array
    const departmentComparison = Object.values(deptMap).map(d => ({
      name: d.name,
      code: d.code,
      count: d.count,
      avgTeaching: Number((d.teaching / d.count).toFixed(1)),
      avgResearch: Number((d.research / d.count).toFixed(1)),
      avgService: Number((d.service / d.count).toFixed(1)),
      avgTotalScore: Number((d.total / d.count).toFixed(1)),
      avgBonusScore: Number((d.bonus / d.count).toFixed(1)),
      avgFinalScore: Number((d.finalScore / d.count).toFixed(1))
    })).sort((a, b) => b.avgFinalScore - a.avgFinalScore);

    // Designation Comparison Array - return all cadres with safe zero fallback
    const designationComparison = Object.entries(desigMap)
      .map(([desigKey, data]) => ({
        designation: desigKey.replace(/_/g, ' '),
        rawKey: desigKey,
        count: data.count,
        avgTeaching: data.count > 0 ? Number((data.teaching / data.count).toFixed(1)) : 0,
        avgResearch: data.count > 0 ? Number((data.research / data.count).toFixed(1)) : 0,
        avgService: data.count > 0 ? Number((data.service / data.count).toFixed(1)) : 0,
        avgTotalScore: data.count > 0 ? Number((data.total / data.count).toFixed(1)) : 0,
        avgBonusScore: data.count > 0 ? Number((data.bonus / data.count).toFixed(1)) : 0,
        avgFinalScore: data.count > 0 ? Number((data.finalScore / data.count).toFixed(1)) : 0
      }));

    // Year over Year Trend
    const yearGroupMap: Record<string, { count: number; sumFinal: number; sumTotal: number; sumBonus: number }> = {};
    applications.forEach(app => {
      const year = app.academic_year;
      if (!yearGroupMap[year]) {
        yearGroupMap[year] = { count: 0, sumFinal: 0, sumTotal: 0, sumBonus: 0 };
      }
      yearGroupMap[year].count++;
      yearGroupMap[year].sumTotal += Number(app.total_score || 0);
      yearGroupMap[year].sumBonus += Number(app.bonus_score || 0);
      yearGroupMap[year].sumFinal += Number(app.final_score || 0);
    });

    const yearOverYearTrend = Object.entries(yearGroupMap).map(([year, d]) => ({
      year,
      count: d.count,
      avgTotal: Number((d.sumTotal / d.count).toFixed(1)),
      avgBonus: Number((d.sumBonus / d.count).toFixed(1)),
      avgFinal: Number((d.sumFinal / d.count).toFixed(1))
    })).sort((a, b) => a.year.localeCompare(b.year));

    // Top Performers Leaderboard
    const topPerformers = applications
      .map(app => ({
        id: app.id,
        facultyName: app.faculty.name,
        department: app.faculty.department?.name || 'N/A',
        designation: app.faculty.designation?.replace(/_/g, ' ') || 'N/A',
        academicYear: app.academic_year,
        totalScore: Number(app.total_score || 0),
        bonusScore: Number(app.bonus_score || 0),
        finalScore: Number(app.final_score || 0)
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        filters: {
          availableYears,
          availableDepartments,
          userRole: user.role,
          appliedDepartmentId: department_id || 'ALL'
        },
        summary: {
          totalApplications: count,
          avgTeaching: Number((sumTeaching / count).toFixed(1)),
          avgResearch: Number((sumResearch / count).toFixed(1)),
          avgService: Number((sumService / count).toFixed(1)),
          avgTotalScore: Number((sumTotal / count).toFixed(1)),
          avgBonusScore: Number((sumBonus / count).toFixed(1)),
          avgFinalScore: Number((sumFinal / count).toFixed(1)),
          maxFinalScore: maxFinalScore === -Infinity ? 0 : Number(maxFinalScore.toFixed(1)),
          minFinalScore: minFinalScore === Infinity ? 0 : Number(minFinalScore.toFixed(1)),
          totalJournals,
          totalPatents,
          totalFunded: Number(totalFunded.toFixed(1))
        },
        scoreDistribution,
        departmentComparison,
        designationComparison,
        yearOverYearTrend,
        topPerformers
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
