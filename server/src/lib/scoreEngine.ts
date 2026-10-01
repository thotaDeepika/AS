import prisma from '../lib/prisma.js';

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
  bonus: number;
  finalScore: number;
}

/**
 * Legacy Score Calculation Engine (100% Exact Replica of legacy cal.txt algorithm)
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
      const hasEntries = Array.isArray(rawValue.fci_entries) && rawValue.fci_entries.length > 0;
      const fci = (hasEntries || rawValue.fci_percentage !== undefined)
        ? Number(rawValue.fci_percentage || 0)
        : Number(rawValue.fciScore || 0);

      if (fci <= 0) {
        score = 0;
      } else if (fci >= 85) {
        score = 1 * sectionMax;
      } else if (fci >= 80) {
        score = 0.9 * sectionMax;
      } else if (fci >= 75) {
        score = 0.8 * sectionMax;
      } else if (fci >= 70) {
        score = 0.7 * sectionMax;
      } else {
        score = 0.4 * sectionMax;
      }
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RESEARCH — Categories 2-12
    // ══════════════════════════════════════════════════════════════════════════

    // Category 2: Non-paid Refereed Journal Papers (SJR/Scopus/WoS) -> Bonus Generating
    case 2: {
      const refJournal = Number(rawValue.count || rawValue.nirfJournals || 0);
      if (refJournal > 0) {
        score = sectionMax * refJournal;
      } else {
        score = 0;
      }
      break;
    }

    // Category 3: Indexed Conference Papers -> Regular Research
    case 3: {
      const indexedPapers = Number(rawValue.count || rawValue.indexedPapers || 0);
      const isAsst = designation === 'ASSISTANT_PROFESSOR' ? 1 : 0;
      const isAssoc = designation === 'ASSOCIATE_PROFESSOR' ? 1 : 0;
      const isProf = (designation === 'PROFESSOR' || designation === 'HEAD') ? 1 : 0;

      if (indexedPapers > 0) {
        if (isAsst === 1) {
          if (indexedPapers === 1) score = sectionMax / 2;
          else if (indexedPapers >= 2) score = sectionMax;
        } else if (isAssoc === 1) {
          if (indexedPapers === 1) score = sectionMax * 0.25;
          else if (indexedPapers === 2) score = sectionMax * 0.5;
          else if (indexedPapers === 3) score = sectionMax * 0.75;
          else if (indexedPapers >= 4) score = sectionMax;
        } else if (isProf === 1) {
          if (indexedPapers === 1) score = sectionMax * 0.2;
          else if (indexedPapers === 2) score = sectionMax * 0.4;
          else if (indexedPapers === 3) score = sectionMax * 0.6;
          else if (indexedPapers === 4) score = sectionMax * 0.8;
          else if (indexedPapers >= 5) score = sectionMax;
        }
      } else {
        score = 0;
      }
      break;
    }

    // Category 4: Non-refereed Journals & Non-indexed Conferences -> Regular Research
    case 4: {
      const journalPublication = Number(rawValue.count || rawValue.journalPublication || 0);
      if (journalPublication > 0) {
        score = sectionMax * 0.1;
      } else {
        score = 0;
      }
      break;
    }

    // Category 5: Books / Chapters -> Regular Research
    case 5: {
      const books = Number(rawValue.books || 0);
      const booksChapters = Number(rawValue.chapters || rawValue.booksChapters || 0);

      if (books > 0 || booksChapters > 0) {
        if (books === 0) {
          if (booksChapters >= 1 && booksChapters <= 5) score = sectionMax * 0.2 * booksChapters;
          else if (booksChapters > 5) score = sectionMax;
        } else if (booksChapters === 0) {
          if (books >= 1 && books <= 2) score = sectionMax * 0.5 * books;
          else if (books > 2) score = sectionMax;
        } else {
          const bookScore = (books <= 2) ? (0.5 * sectionMax * books) : sectionMax;
          const bookChapScore = (booksChapters <= 5) ? (0.2 * sectionMax * booksChapters) : sectionMax;
          score = ((bookScore + bookChapScore) <= sectionMax) ? (bookScore + bookChapScore) : sectionMax;
        }
      } else {
        score = 0;
      }
      break;
    }

    // Category 6: Disclosures Filed -> Regular Research
    case 6: {
      const disclosuresFiled = Number(rawValue.count || rawValue.disclosuresFiled || 0);
      if (disclosuresFiled > 0) {
        if (disclosuresFiled <= 10) score = sectionMax * 0.1 * disclosuresFiled;
        else score = sectionMax;
      } else {
        score = 0;
      }
      break;
    }

    // Category 7: Patents Granted -> Bonus Generating
    case 7: {
      const patentsGranted = Number(rawValue.count || rawValue.patentsGranted || 0);
      if (patentsGranted > 0) {
        score = sectionMax * 0.5 * patentsGranted;
      } else {
        score = 0;
      }
      break;
    }

    // Category 8: Research Guidance UG -> Regular Research
    case 8: {
      const researchGuidanceUg = Number(rawValue.count || rawValue.researchGuidanceUg || 0);
      if (researchGuidanceUg > 0) {
        score = Number((0.01 * sectionMax * researchGuidanceUg).toFixed(2));
        if (score > sectionMax) score = sectionMax;
      } else {
        score = 0;
      }
      break;
    }

    // Category 9: Research Guidance Master's -> Regular Research
    case 9: {
      const researchGuidanceMaster = Number(rawValue.count || rawValue.researchGuidanceMaster || 0);
      if (researchGuidanceMaster > 0) {
        score = Number((0.03 * sectionMax * researchGuidanceMaster).toFixed(2));
        if (score > sectionMax) score = sectionMax;
      } else {
        score = 0;
      }
      break;
    }

    // Category 10: Research Guidance PhD -> Regular Research
    case 10: {
      const researchGuidancePhd = Number(rawValue.count || rawValue.researchGuidancePhd || 0);
      if (researchGuidancePhd > 0) {
        score = Number((0.07 * sectionMax * researchGuidancePhd).toFixed(2));
        if (score > sectionMax) score = sectionMax;
      } else {
        score = 0;
      }
      break;
    }

    // Category 11: Funded Projects -> Bonus Generating
    case 11: {
      const f1 = Number(rawValue.fundedProjects1 || rawValue.tier1_count || 0);
      const f2 = Number(rawValue.fundedProjects2 || rawValue.tier2_count || 0);
      const f3 = Number(rawValue.fundedProjects3 || rawValue.tier3_count || 0);
      const f4 = Number(rawValue.fundedProjects4 || rawValue.tier4_count || 0);

      if (f1 > 0 || f2 > 0 || f3 > 0 || f4 > 0) {
        const funded1Score = f1 * sectionMax * 1;
        const funded2Score = f2 * sectionMax * 0.5;
        const funded3Score = f3 * sectionMax * 0.3;
        const funded4Score = f4 * sectionMax * 0.2;
        score = funded1Score + funded2Score + funded3Score + funded4Score;
      } else {
        const amount = Number(rawValue.amount_lakhs || 0);
        let pct = 0;
        if (amount >= 10) pct = 100;
        else if (amount >= 5) pct = 50;
        else if (amount >= 1) pct = 30;
        else if (amount > 0) pct = 20;
        score = (pct / 100) * sectionMax;
      }
      break;
    }

    // Category 12: Consulting Projects -> Bonus Generating
    case 12: {
      const c1 = Number(rawValue.consultingProjects1 || rawValue.tier1_count || 0);
      const c2 = Number(rawValue.consultingProjects2 || rawValue.tier2_count || 0);
      const c3 = Number(rawValue.consultingProjects3 || rawValue.tier3_count || 0);
      const c4 = Number(rawValue.consultingProjects4 || rawValue.tier4_count || 0);

      if (c1 > 0 || c2 > 0 || c3 > 0 || c4 > 0) {
        const consulting1Score = c1 * sectionMax * 1;
        const consulting2Score = c2 * sectionMax * 0.6;
        const consulting3Score = c3 * sectionMax * 0.5;
        const consulting4Score = c4 * sectionMax * 0.2;
        score = consulting1Score + consulting2Score + consulting3Score + consulting4Score;
      } else {
        const amount = Number(rawValue.amount_lakhs || 0);
        let pct = 0;
        if (amount >= 10) pct = 100;
        else if (amount >= 5) pct = 60;
        else if (amount >= 1) pct = 50;
        else if (amount > 0) pct = 20;
        score = (pct / 100) * sectionMax;
      }
      break;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SERVICE & PROFESSIONAL DEVELOPMENT — Categories 13-23
    // ══════════════════════════════════════════════════════════════════════════

    case 13: {
      const chairReview = Number(rawValue.count || rawValue.chairReviewer || 0);
      score = chairReview > 0 ? 0.05 * sectionMax : 0;
      break;
    }

    case 14: {
      const fiveDayWorkShop = Number(rawValue.fiveDayWorkShop || rawValue.five_day_count || 0);
      const threeDayWorkShop = Number(rawValue.threeDayWorkShop || rawValue.three_day_count || 0);

      if (fiveDayWorkShop > 0 || threeDayWorkShop > 0) {
        if (fiveDayWorkShop === 0) score = 0.05 * sectionMax;
        else if (threeDayWorkShop === 0) score = 0.1 * sectionMax;
        else {
          score = (0.1 * sectionMax) + (0.05 * sectionMax);
        }
      } else {
        const days = Number(rawValue.days || 0);
        if (days >= 5) score = 0.1 * sectionMax;
        else if (days >= 3) score = 0.05 * sectionMax;
        else score = 0;
      }
      break;
    }

    case 15: {
      const invitedTalksOutside = Number(rawValue.count || rawValue.invitedTalksOutside || 0);
      score = invitedTalksOutside > 0 ? 0.1 * sectionMax : 0;
      break;
    }

    case 16: {
      const eventsOutside = Number(rawValue.count || rawValue.eventsOutside || 0);
      score = eventsOutside > 0 ? 0.1 * sectionMax : 0;
      break;
    }

    case 17: {
      const invitedTalksInside = Number(rawValue.count || rawValue.invitedTalksInside || 0);
      score = invitedTalksInside > 0 ? 0.05 * sectionMax : 0;
      break;
    }

    case 18: {
      const industryRelations = Number(rawValue.count || rawValue.industryRelations || 0);
      score = industryRelations > 0 ? 0.1 * sectionMax : 0;
      break;
    }

    case 19: {
      const instDeptServicesCoordinator = Number(rawValue.instDeptServicesCoordinator || rawValue.coordinator_count || 0);
      const instDeptServicesOthers = Number(rawValue.instDeptServicesOthers || rawValue.member_count || 0);

      if (instDeptServicesCoordinator > 0 || instDeptServicesOthers > 0) {
        if (instDeptServicesOthers === 0) score = 0.2 * sectionMax;
        else if (instDeptServicesCoordinator === 0) score = 0.05 * sectionMax;
        else {
          score = (0.05 * sectionMax) + (0.2 * sectionMax);
        }
      } else {
        const role = String(rawValue.role || '');
        const count = rawValue.count !== undefined ? Number(rawValue.count) : 1;
        if (role === 'coordinator') score = count * 0.2 * sectionMax;
        else if (role === 'member') score = count * 0.05 * sectionMax;
      }
      break;
    }

    case 20: {
      const othServices = Number(rawValue.count || rawValue.othServices || 0);
      score = othServices > 0 ? Number((0.03 * sectionMax).toFixed(2)) : 0;
      break;
    }

    case 21: {
      const awardsHonours = Number(rawValue.count || rawValue.awardsHonours || 0);
      if (awardsHonours > 0) {
        const calc = 0.15 * awardsHonours * sectionMax;
        score = calc >= sectionMax ? sectionMax : calc;
      } else {
        score = 0;
      }
      break;
    }

    case 22: {
      const profTeam = Number(rawValue.count || rawValue.profTeam || 0);
      score = profTeam > 0 ? Number((0.02 * sectionMax).toFixed(2)) : 0;
      break;
    }

    case 23: {
      score = 0;
      break;
    }

    default:
      score = 0;
  }

  return Math.max(score, 0);
}

/**
 * Calculate all scores for an application (1:1 Legacy cal.txt algorithm).
 * Applies legacy section caps, bonus overflow logic (bonusS), and total score caps.
 */
export async function calculateApplicationScores(
  applicationId: string,
  designation: string
): Promise<{ entries: ScoreResult[]; totals: SectionTotals }> {
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

  const sectionMultipliers: Record<string, Record<string, number>> = {
    ASSISTANT_PROFESSOR: { TEACHING: 60, RESEARCH: 10, SERVICE: 30 },
    ASSOCIATE_PROFESSOR: { TEACHING: 50, RESEARCH: 20, SERVICE: 30 },
    PROFESSOR:           { TEACHING: 40, RESEARCH: 30, SERVICE: 30 },
    HEAD:                { TEACHING: 40, RESEARCH: 30, SERVICE: 30 },
  };

  const normalizedDesig = designation.toUpperCase().replace(/\s+/g, '_');
  let maxes = sectionMultipliers[normalizedDesig];
  if (!maxes) {
    if (normalizedDesig.includes('ASSOCIATE')) maxes = sectionMultipliers.ASSOCIATE_PROFESSOR;
    else if (normalizedDesig.includes('PROFESSOR') || normalizedDesig.includes('HEAD')) maxes = sectionMultipliers.PROFESSOR;
    else maxes = sectionMultipliers.ASSISTANT_PROFESSOR;
  }

  const results: ScoreResult[] = [];

  let teachingRaw = 0;
  let serviceRaw = 0;
  let regResearchRaw = 0;
  let bonusResearchRaw = 0;

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

    const slNo = entry.category.sl_no;

    if (entry.category.section === 'TEACHING') {
      teachingRaw += score;
    } else if (entry.category.section === 'RESEARCH') {
      // Categories 2, 7, 11, 12 are bonus-generating categories in legacy cal.txt
      if ([2, 7, 11, 12].includes(slNo)) {
        bonusResearchRaw += score;
      } else {
        regResearchRaw += score;
      }
    } else {
      serviceRaw += score;
    }
  }

  const maxTeaching = maxes.TEACHING;
  const maxResearch = maxes.RESEARCH;
  const maxService = maxes.SERVICE;

  // Capping Teaching and Service scores per legacy rules
  const teachingScore = Math.min(teachingRaw, maxTeaching);
  const serviceScore = Math.min(serviceRaw, maxService);

  let resScore = regResearchRaw;
  let bonusScore = bonusResearchRaw;

  // Legacy bonusS() overflow & deficit absorption algorithm from cal.txt (lines 207–219)
  if ((resScore + bonusScore) <= maxResearch) {
    resScore = Number((resScore + bonusScore).toFixed(1));
    bonusScore = 0;
  } else if (resScore >= maxResearch) {
    resScore = maxResearch;
    bonusScore = Number(bonusScore.toFixed(1));
  } else {
    // resScore < maxResearch && (resScore + bonusScore) > maxResearch
    const deficit = maxResearch - resScore;
    resScore = maxResearch;
    bonusScore = Number((bonusScore - deficit).toFixed(1));
  }

  let totalScore = teachingScore + serviceScore + resScore;
  totalScore = Number(totalScore.toFixed(1));
  if (totalScore > 100) {
    totalScore = 100;
  }

  let finalScore = totalScore + bonusScore;
  finalScore = Number(finalScore.toFixed(1));

  return {
    entries: results,
    totals: {
      teaching: teachingScore,
      research: resScore,
      service: serviceScore,
      total: totalScore,
      bonus: bonusScore,
      finalScore: finalScore,
    },
  };
}
