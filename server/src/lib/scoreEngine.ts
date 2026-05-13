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
  [key: string]: number;
  teaching: number;
  research: number;
  service: number;
  total: number;
}

/**
 * Calculate score for a single category entry based on designation-specific rules.
 * All 23 scoring categories from FINAL_SCORING.md are handled here.
 *
 * Scoring Model:
 * - Each category score is calculated as a percentage of the SECTION max.
 * - Section maxes: Teaching (AP=60, AssoP=50, Prof=40), Research (AP=10, AssoP=20, Prof=30), Service (all=30)
 * - Research & Service scores are additive across categories, capped at the section max.
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
    // ══════════════════════════════════════════════════════════════════════════
    // TEACHING — Category 1: FCI Score
    // ══════════════════════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════════════════════
    // RESEARCH — Categories 2-12
    // ══════════════════════════════════════════════════════════════════════════

    // Category 2: Non-paid Refereed Journal Papers (SJR/Scopus/WoS)
    // 1 paper = 100% of research weightage
    case 2: {
      const papers = Number(rawValue.count || 0);
      score = papers >= 1 ? sectionMax : 0;
      break;
    }

    // Category 3: Indexed Conference Papers (SJR/Scopus/WoS)
    // Designation-based: AP=50%, AssoP=25%, Prof=20% per paper
    case 3: {
      const papers = Number(rawValue.count || 0);
      let pctPerPaper = 0;
      if (designation === 'ASSISTANT_PROFESSOR') pctPerPaper = 50;
      else if (designation === 'ASSOCIATE_PROFESSOR') pctPerPaper = 25;
      else pctPerPaper = 20;
      score = (papers * pctPerPaper / 100) * sectionMax;
      break;
    }

    // Category 4: Non-paid Non-refereed Journals & Non-indexed Conferences
    // 10% of research weightage if count > 0
    case 4: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 5: Books/Chapters
    // 1 book = 50%, 1 chapter = 20% of research weightage
    case 5: {
      const books = Number(rawValue.books || 0);
      const chapters = Number(rawValue.chapters || 0);
      score = ((books * 50 + chapters * 20) / 100) * sectionMax;
      break;
    }

    // Category 6: Disclosures Filed — 1 disclosure = 10%
    case 6: {
      const count = Number(rawValue.count || 0);
      score = (count * 10 / 100) * sectionMax;
      break;
    }

    // Category 7: Patents Granted — 1 patent = 50%
    case 7: {
      const count = Number(rawValue.count || 0);
      score = (count * 50 / 100) * sectionMax;
      break;
    }

    // Category 8: Research Guidance UG — 1 batch = 1%
    case 8: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 1 / 100) * sectionMax;
      break;
    }

    // Category 9: Research Guidance PG — 1 batch = 3%
    case 9: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 3 / 100) * sectionMax;
      break;
    }

    // Category 10: Research Guidance PhD — 1 batch = 7%
    case 10: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 7 / 100) * sectionMax;
      break;
    }

    // Category 11: Funded Projects (slab-based)
    case 11: {
      const amount = Number(rawValue.amount_lakhs || 0);
      let pct = 0;
      if (amount >= 10) pct = 100;
      else if (amount >= 5) pct = 50;
      else if (amount >= 1) pct = 30;
      else if (amount > 0) pct = 20;
      score = (pct / 100) * sectionMax;
      break;
    }

    // Category 12: Consulting Projects (slab-based)
    case 12: {
      const amount = Number(rawValue.amount_lakhs || 0);
      let pct = 0;
      if (amount >= 10) pct = 100;
      else if (amount >= 5) pct = 60;
      else if (amount >= 1) pct = 50;
      else if (amount > 0) pct = 20;
      score = (pct / 100) * sectionMax;
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SERVICE & PROFESSIONAL DEVELOPMENT — Categories 13-23
    // ══════════════════════════════════════════════════════════════════════════

    // Category 13: Conference Chair/Session Chair/Reviewer Q1/Q2 — 5%
    case 13: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (5 / 100) * sectionMax : 0;
      break;
    }

    // Category 14: FDP/Seminar/Workshop organized as coordinator
    // 5 days = 10%, 3 days = 5%
    case 14: {
      const days = Number(rawValue.days || 0);
      let pct = 0;
      if (days >= 5) pct = 10;
      else if (days >= 3) pct = 5;
      score = (pct / 100) * sectionMax;
      break;
    }

    // Category 15: Invited Technical Talks outside Institute — 10%
    case 15: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 16: Events Participated Outside Institute — 10%
    case 16: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 17: Events Participated Inside Institute — 5%
    case 17: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (5 / 100) * sectionMax : 0;
      break;
    }

    // Category 18: Industry Relations — 10%
    case 18: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 19: Institutional/Departmental Services (NBA/NIRF)
    // Coordinator = 20%, Others = 5%
    case 19: {
      const role = String(rawValue.role || '');
      if (role === 'coordinator') score = (20 / 100) * sectionMax;
      else if (role === 'member') score = (5 / 100) * sectionMax;
      break;
    }

    // Category 20: Other Services to Institution/Society — 3%
    case 20: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (3 / 100) * sectionMax : 0;
      break;
    }

    // Category 21: Awards and Honours — 1 event = 15%
    case 21: {
      const count = Number(rawValue.count || 0);
      score = (count * 15 / 100) * sectionMax;
      break;
    }

    // Category 22: Professionalism / Team Spirit — 2%
    case 22: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (2 / 100) * sectionMax : 0;
      break;
    }

    // Category 23: Any Other Major Contributions — free text, no auto scoring
    case 23: {
      score = 0;
      break;
    }

    default:
      score = 0;
  }

  // Cap at section max (max_weightage = section max in our model)
  return Math.min(Math.max(score, 0), sectionMax);
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

  // Section maximums by designation (from FINAL_SCORING.md)
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
    const rawValue = entry.raw_value as Record<string, any>;

    const score = await calculateCategoryScore(
      entry.category.sl_no,
      designation,
      rawValue,
      Number(rule.max_weightage),
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
