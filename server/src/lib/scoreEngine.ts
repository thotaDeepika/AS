import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma.js';

interface CategoryInput {
  category_id: string;
  raw_value: Record<string, any>;
}

interface ScoreResult {
  category_id: string;
  calculated_score: number;
}

interface SectionTotals {
  teaching: number;
  research: number;
  service: number;
  total: number;
}

/**
 * Calculate score for a single category entry based on designation-specific rules.
 * All 23 scoring categories from FINAL_SCORING.md are handled here.
 */
export async function calculateCategoryScore(
  categorySlNo: number,
  designation: string,
  rawValue: Record<string, any>,
  maxWeightage: number,
  sectionMax: number
): Promise<number> {
  let score = 0;

  switch (categorySlNo) {
    // ── TEACHING ─────────────────────────────────────────────────────────────
    // Category 1: FCI Score
    case 1: {
      const fci = Number(rawValue.fci_percentage || 0);
      let pct = 0;
      if (fci >= 85) pct = 100;
      else if (fci >= 80) pct = 90;
      else if (fci >= 75) pct = 80;
      else if (fci >= 70) pct = 70;
      else pct = 40;
      score = (pct / 100) * sectionMax;
      break;
    }

    // Categories 2-8: Simple number-based (marks per item, capped at max)
    case 2: case 3: case 4: case 5: case 6: case 7: case 8: {
      const value = Number(rawValue.value || 0);
      score = Math.min(value * (maxWeightage / Math.max(value, 1)), maxWeightage);
      // Simplified: proportional to max weightage
      score = Math.min(value, maxWeightage);
      break;
    }

    // ── RESEARCH ─────────────────────────────────────────────────────────────
    // Category 9: Non-paid Refereed Journal Papers (SJR/Scopus/WoS)
    case 9: {
      const papers = Number(rawValue.count || 0);
      // 1 paper = 100% of research weightage
      score = papers >= 1 ? sectionMax : 0;
      break;
    }

    // Category 10: Indexed Conference Papers
    case 10: {
      const papers = Number(rawValue.count || 0);
      let pctPerPaper = 0;
      if (designation === 'ASSISTANT_PROFESSOR') pctPerPaper = 50;
      else if (designation === 'ASSOCIATE_PROFESSOR') pctPerPaper = 25;
      else pctPerPaper = 20;
      score = (papers * pctPerPaper / 100) * sectionMax;
      break;
    }

    // Category 11: Non-refereed Journals & Non-indexed Conferences
    case 11: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 12: Books/Chapters
    case 12: {
      const books = Number(rawValue.books || 0);
      const chapters = Number(rawValue.chapters || 0);
      score = ((books * 50 + chapters * 20) / 100) * sectionMax;
      break;
    }

    // Category 13: Disclosures Filed
    case 13: {
      const count = Number(rawValue.count || 0);
      score = (count * 10 / 100) * sectionMax;
      break;
    }

    // Category 14: Patents Granted
    case 14: {
      const count = Number(rawValue.count || 0);
      score = (count * 50 / 100) * sectionMax;
      break;
    }

    // Category 15: Research Guidance UG
    case 15: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 1 / 100) * sectionMax;
      break;
    }

    // Category 16: Research Guidance PG
    case 16: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 3 / 100) * sectionMax;
      break;
    }

    // Category 17: Research Guidance PhD
    case 17: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 7 / 100) * sectionMax;
      break;
    }

    // Category 18: Funded Projects (slab-based)
    case 18: {
      const amount = Number(rawValue.amount_lakhs || 0);
      let pct = 0;
      if (amount >= 10) pct = 100;
      else if (amount >= 5) pct = 50;
      else if (amount >= 1) pct = 30;
      else if (amount > 0) pct = 20;
      score = (pct / 100) * sectionMax;
      break;
    }

    // Category 19: Consulting Projects (slab-based)
    case 19: {
      const amount = Number(rawValue.amount_lakhs || 0);
      let pct = 0;
      if (amount >= 10) pct = 100;
      else if (amount >= 5) pct = 60;
      else if (amount >= 1) pct = 50;
      else if (amount > 0) pct = 20;
      score = (pct / 100) * sectionMax;
      break;
    }

    // ── SERVICE & PROFESSIONAL DEVELOPMENT ───────────────────────────────────
    // Category 20: Conference Chair/Session Chair/Reviewer Q1/Q2
    case 20: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (5 / 100) * sectionMax : 0;
      break;
    }

    // Category 21: FDP/Seminar/Workshop organized as coordinator
    case 21: {
      const days = Number(rawValue.days || 0);
      let pct = 0;
      if (days >= 5) pct = 10;
      else if (days >= 3) pct = 5;
      score = (pct / 100) * sectionMax;
      break;
    }

    // Category 22: Invited Technical Talks outside Institute
    case 22: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 23: Events Participated Outside Institute
    case 23: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    default:
      score = 0;
  }

  // Cap at max weightage for this category
  return Math.min(Math.max(score, 0), maxWeightage);
}

/**
 * Calculate all scores for an application.
 * Returns per-category scores and section totals.
 */
export async function calculateApplicationScores(
  applicationId: string,
  designation: string
): Promise<{ entries: ScoreResult[]; totals: SectionTotals }> {
  // Fetch all category entries with their categories and rules
  const entries = await prisma.categoryEntry.findMany({
    where: { application_id: applicationId },
    include: {
      category: {
        include: {
          scoring_rules: {
            where: { designation: designation as any },
          },
        },
      },
    },
  });

  // Section maximums by designation
  const sectionMaxes: Record<string, Record<string, number>> = {
    ASSISTANT_PROFESSOR: { TEACHING: 60, RESEARCH: 10, SERVICE: 30 },
    ASSOCIATE_PROFESSOR: { TEACHING: 50, RESEARCH: 20, SERVICE: 30 },
    PROFESSOR:           { TEACHING: 40, RESEARCH: 30, SERVICE: 30 },
  };

  const maxes = sectionMaxes[designation] || sectionMaxes.ASSISTANT_PROFESSOR;
  const sectionScores = { teaching: 0, research: 0, service: 0 };
  const results: ScoreResult[] = [];

  for (const entry of entries) {
    const rule = entry.category.scoring_rules[0];
    if (!rule) continue;

    const sectionMax = maxes[entry.category.section] || 0;
    const maxW = Number(rule.max_weightage);
    const rawValue = entry.raw_value as Record<string, any>;

    const score = await calculateCategoryScore(
      entry.category.sl_no,
      designation,
      rawValue,
      maxW,
      sectionMax
    );

    results.push({ category_id: entry.category_id, calculated_score: score });

    // Accumulate to section
    if (entry.category.section === 'TEACHING') sectionScores.teaching += score;
    else if (entry.category.section === 'RESEARCH') sectionScores.research += score;
    else sectionScores.service += score;
  }

  // Cap sections at their max
  sectionScores.teaching = Math.min(sectionScores.teaching, maxes.TEACHING);
  sectionScores.research = Math.min(sectionScores.research, maxes.RESEARCH);
  sectionScores.service = Math.min(sectionScores.service, maxes.SERVICE);

  const total = Math.min(
    sectionScores.teaching + sectionScores.research + sectionScores.service,
    100
  );

  return {
    entries: results,
    totals: {
      teaching: sectionScores.teaching,
      research: sectionScores.research,
      service: sectionScores.service,
      total,
    },
  };
}
