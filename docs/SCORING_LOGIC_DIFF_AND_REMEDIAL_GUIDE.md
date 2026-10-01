# Scoring Logic Differences & Remedial Correction Guide
**Deep Mathematical Analysis & Code Fixes: Legacy (`cal.txt`) vs. Implemented (`scoreEngine.ts`)**

---

## 1. Overview of Core Algorithmic Divergence

While both systems utilize the same base multipliers per designation (Teaching: 60/50/40, Research: 10/20/30, Service: 30/30/30), there are major mathematical differences between how scores were calculated in the legacy JavaScript (`DATA/cal.txt`) and how they are implemented in the Node.js score engine (`Software/server/src/lib/scoreEngine.ts`).

---

## 2. Comprehensive Category-by-Category Calculation Matrix

| Category | Description | Legacy Formula (`cal.txt`) | Implemented Formula (`scoreEngine.ts`) | Discrepancy Level | Analysis & Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cat 1** | FCI Score | FCI >= 85: 100%<br>80-84: 90%<br>75-79: 80%<br>70-74: 70%<br><70: 40%<br>0: 0% | Same slab percentages multiplied by `sectionMax`. | **MATCH** | Exact logical equivalence. |
| **Cat 2** | Refereed Journals (SJR/Scopus/WoS) | `score2 = count * Max_Research_Score`<br>*(Each paper gives 100% of Research base score)* | `score = count >= 1 ? sectionMax : 0`<br>*(Flattens score to 10 points max regardless of count!)* | 🚨 **CRITICAL BUG IN NEW ENGINE** | In legacy, 2 papers = 20 points (contributes to Research overflow/bonus). In new engine, 2 papers = 10 points (ignores extra papers!). |
| **Cat 3** | Indexed Conference Papers | AP: 1=50%, >=2=100%<br>AssocP: 1=25%, 2=50%, 3=75%, >=4=100%<br>Prof: 1=20%, 2=40%, 3=60%, 4=80%, >=5=100% | `count * pctPerPaper * sectionMax`<br>*(Uncapped per paper multiplier)* | ⚠️ **CAP DIVERGENCE** | Legacy caps Cat 3 at 100% of Research base score (e.g. 10 pts). New engine does not cap Cat 3 per category. |
| **Cat 4** | Non-refereed / Non-indexed | `count > 0 ? 10% * Max : 0` | `count > 0 ? 10% * sectionMax : 0` | **MATCH** | Flat 10% awarded if count > 0. |
| **Cat 5** | Books & Chapters | `bookScore = min(books * 0.5 * Max, Max)`<br>`chapScore = min(chaps * 0.2 * Max, Max)`<br>`Cat 5 = min(bookScore + chapScore, Max)` | `((books * 50 + chaps * 20) / 100) * sectionMax` | ⚠️ **CAP DIVERGENCE** | Legacy caps book score, chapter score, and total Cat 5 at `Max_Research_Score`. New engine is uncapped. |
| **Cat 6** | Disclosures Filed | `min(count * 0.1 * Max, Max)` | `(count * 10 / 100) * sectionMax` | ⚠️ **CAP DIVERGENCE** | Legacy caps at 10 disclosures (100%). New engine is uncapped. |
| **Cat 7** | Patents Granted | `count * 0.5 * Max` | `count * 50 / 100 * sectionMax` | **MATCH** | 50% of research base per patent. Legacy feeds overflow to bonus. |
| **Cat 8, 9, 10** | Research Guidance (UG / Master / PhD) | UG: `min(count * 0.01 * Max, Max)`<br>PG: `min(count * 0.03 * Max, Max)`<br>PhD: `min(count * 0.07 * Max, Max)` | UG: `count * 1% * sectionMax`<br>PG: `count * 3% * sectionMax`<br>PhD: `count * 7% * sectionMax` | ⚠️ **CAP DIVERGENCE** | Legacy caps individual guidance categories at `Max`. New engine is uncapped. |
| **Cat 11** | Funded Projects | Inputs for 4 tiers (`>=10L`, `5-10L`, `1-5L`, `<1L`).<br>`score11 = (f1*1.0 + f2*0.5 + f3*0.3 + f4*0.2) * Max` | Evaluates single `amount_lakhs` amount on slab (`>=10L` -> 100%, `>=5L` -> 50%, etc.). | 🚨 **CRITICAL BUG IN NEW ENGINE** | Legacy sums multiple projects across tiers (e.g. two >=10L projects = `2.0 * Max = 20 pts`). New engine only handles a single project amount. |
| **Cat 12** | Consulting Projects | Inputs for 4 tiers (`>=10L`, `5-10L`, `1-5L`, `<1L`).<br>`score12 = (c1*1.0 + c2*0.6 + c3*0.5 + c4*0.2) * Max` | Evaluates single `amount_lakhs` amount on slab (`>=10L` -> 100%, `>=5L` -> 60%, etc.). | 🚨 **CRITICAL BUG IN NEW ENGINE** | Legacy sums multiple consulting projects per tier. New engine only evaluates a single numeric funding amount. |
| **Cat 13** | Session Chair / Reviewer | `count > 0 ? 5% * Max_Service : 0` | `count > 0 ? 5% * sectionMax : 0` | **MATCH** | Flat 5% awarded. |
| **Cat 14** | FDP/Workshop Organized | Checks 5-day and 3-day counts.<br>If both present: `10% + 5% = 15%`. | Checks single `days` field (`days >= 5` -> 10%, `days >= 3` -> 5%). | 🚨 **LOGIC DIVERGENCE** | Legacy allows separate counts for 5-day and 3-day workshops and sums them. |
| **Cat 15-18** | Talks / Events / Industry | Cat 15: 10%, Cat 16: 10%, Cat 17: 5%, Cat 18: 10% | Cat 15: 10%, Cat 16: 10%, Cat 17: 5%, Cat 18: 10% | **MATCH** | Identical logic. |
| **Cat 19** | Inst / Dept Services (NBA/NIRF) | `coordinatorScore = 20% * Max`<br>`otherScore = 5% * Max`<br>If both present, sums both (`25% * Max`). | Evaluates single role (`coordinator` -> 20%, `member` -> 5%) multiplied by count. | 🚨 **LOGIC DIVERGENCE** | Legacy evaluates presence of both roles simultaneously. |
| **Cat 20-22** | Other Services / Awards / Prof | Cat 20: 3%, Cat 21: `min(count*15%, 100%)`, Cat 22: 2% | Cat 20: 3%, Cat 21: `count * 15%` (uncapped), Cat 22: 2% | **MATCH / MINOR CAP** | Legacy caps Cat 21 Awards at 100%. |

---

## 3. Major Algorithmic Divergences Explained

### 3.1 The Legacy Bonus Overflow Algorithm (`bonusS`)
In the legacy system (`cal.txt` lines 191–219 & 588–598):
1. **Regular Research Score (`resScore`)** was calculated by summing Categories 3, 4, 5, 6, 8, 9, 10.
2. **Bonus-Generating Research Score (`bonusScore`)** was calculated by summing Categories 2 (Refereed Journals), 7 (Patents), 11 (Funded Projects), and 12 (Consulting Projects).
3. Function `bonusS(resScore, bonusScore)` was executed:
   - If `resScore + bonusScore <= Max_Research_Score`, the bonus score was **absorbed** into `resScore`, and final `bonusScore` became `0`.
   - If `resScore >= Max_Research_Score`, `resScore` was capped at `Max_Research_Score`, and all surplus score from Categories 2, 7, 11, 12 remained in `bonusScore`.
   - If `resScore` was below `Max_Research_Score` but `resScore + bonusScore > Max_Research_Score`, `resScore` was topped up to `Max_Research_Score`, and only the remaining overflow spilled over into `bonusScore`.
4. **Total Score & Final Score**:
   - `totalScore = Teaching_Score + Service_Score + resScore` (Capped at 100).
   - `finalScore = totalScore + bonusScore`.

### 3.2 Implemented System Engine Approach
The implemented system (`Software/server/src/lib/scoreEngine.ts` & `FINAL_SCORING.md`) uses an **uncapped, additive scoring model**:
- Every category independently computes `(percentage / 100) * sectionBaseMultiplier`.
- Section base values (Teaching: 60/50/40, Research: 10/20/30, Service: 30) are treated as **base multipliers** rather than rigid section ceilings.
- No overflow calculation is performed; all category scores are directly added into section totals and `total_score`.

---

## 4. Remedial Action Plan & Code Fixes

To fix the critical bugs in `scoreEngine.ts` (specifically Category 2 journal count bug, Category 11 & 12 funded/consulting multi-tier project count bug, and Category 14/19 multi-count handling), we update `scoreEngine.ts` with complete support for both legacy structures and new inputs.

### 4.1 Required Fixes in `scoreEngine.ts`
1. **Category 2 (Refereed Journals)**:
   - Change `score = papers >= 1 ? sectionMax : 0` to `score = papers * sectionMax`.
   - *Rationale*: A faculty with 2 Scopus journals must get credit for both papers (`2 * sectionMax`), not just 1 paper.
2. **Category 11 & 12 (Funded & Consulting Projects)**:
   - Support both `amount_lakhs` (single project) AND multi-tier project counts (`fundedProjects1`, `fundedProjects2`, `fundedProjects3`, `fundedProjects4` / `consultingProjects1-4`).
   - Calculate tier-weighted totals: `(f1 * 1.0 + f2 * 0.5 + f3 * 0.3 + f4 * 0.2) * sectionMax`.
3. **Category 14 (FDP / Workshop Organized)**:
   - Check `five_day_count` and `three_day_count` in addition to single `days` field so that multiple organized workshops are properly summed.
4. **Category 19 (NBA / NIRF Services)**:
   - Check both `coordinator_count` and `member_count` in addition to single `role` field.

---

## 5. Corrected `scoreEngine.ts` Implementation Code

Below is the fully corrected TypeScript implementation for `Software/server/src/lib/scoreEngine.ts`:

```typescript
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
}

/**
 * Enhanced & Corrected Score Engine for Appraisal System.
 * Fixes multi-count bugs for Refereed Journals (Cat 2), Funded Projects (Cat 11),
 * Consulting Projects (Cat 12), Workshops (Cat 14), and Institutional Services (Cat 19).
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
      const fci = (hasEntries || rawValue.fci_percentage !== undefined) ? Number(rawValue.fci_percentage || 0) : 0;
      let pct = 0;
      if (fci <= 0) pct = 0;
      else if (fci >= 85) pct = 100;
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
    // Each paper gives 100% of research base weightage (Multiplied by count)
    case 2: {
      const papers = Number(rawValue.count || 0);
      score = papers * sectionMax; // Fixed: Multiplies by paper count instead of flattening to 1
      break;
    }

    // Category 3: Indexed Conference Papers (SJR/Scopus/WoS)
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
    case 4: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 5: Books/Chapters
    case 5: {
      const books = Number(rawValue.books || 0);
      const chapters = Number(rawValue.chapters || 0);
      score = ((books * 50 + chapters * 20) / 100) * sectionMax;
      break;
    }

    // Category 6: Disclosures Filed
    case 6: {
      const count = Number(rawValue.count || 0);
      score = (count * 10 / 100) * sectionMax;
      break;
    }

    // Category 7: Patents Granted
    case 7: {
      const count = Number(rawValue.count || 0);
      score = (count * 50 / 100) * sectionMax;
      break;
    }

    // Category 8: Research Guidance UG
    case 8: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 1 / 100) * sectionMax;
      break;
    }

    // Category 9: Research Guidance PG
    case 9: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 3 / 100) * sectionMax;
      break;
    }

    // Category 10: Research Guidance PhD
    case 10: {
      const batches = Number(rawValue.count || 0);
      score = (batches * 7 / 100) * sectionMax;
      break;
    }

    // Category 11: Funded Projects (Supports both tier counts and single amount)
    case 11: {
      const f1 = Number(rawValue.fundedProjects1 || rawValue.tier1_count || 0);
      const f2 = Number(rawValue.fundedProjects2 || rawValue.tier2_count || 0);
      const f3 = Number(rawValue.fundedProjects3 || rawValue.tier3_count || 0);
      const f4 = Number(rawValue.fundedProjects4 || rawValue.tier4_count || 0);

      if (f1 > 0 || f2 > 0 || f3 > 0 || f4 > 0) {
        score = (f1 * 1.0 + f2 * 0.5 + f3 * 0.3 + f4 * 0.2) * sectionMax;
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

    // Category 12: Consulting Projects (Supports both tier counts and single amount)
    case 12: {
      const c1 = Number(rawValue.consultingProjects1 || rawValue.tier1_count || 0);
      const c2 = Number(rawValue.consultingProjects2 || rawValue.tier2_count || 0);
      const c3 = Number(rawValue.consultingProjects3 || rawValue.tier3_count || 0);
      const c4 = Number(rawValue.consultingProjects4 || rawValue.tier4_count || 0);

      if (c1 > 0 || c2 > 0 || c3 > 0 || c4 > 0) {
        score = (c1 * 1.0 + c2 * 0.6 + c3 * 0.5 + c4 * 0.2) * sectionMax;
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
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (5 / 100) * sectionMax : 0;
      break;
    }

    // Category 14: FDP/Seminar/Workshop organized as coordinator
    case 14: {
      const fiveDay = Number(rawValue.fiveDayWorkShop || rawValue.five_day_count || 0);
      const threeDay = Number(rawValue.threeDayWorkShop || rawValue.three_day_count || 0);

      if (fiveDay > 0 || threeDay > 0) {
        const fiveDayScore = fiveDay > 0 ? (0.10 * sectionMax) : 0;
        const threeDayScore = threeDay > 0 ? (0.05 * sectionMax) : 0;
        score = fiveDayScore + threeDayScore;
      } else {
        const days = Number(rawValue.days || 0);
        let pct = 0;
        if (days >= 5) pct = 10;
        else if (days >= 3) pct = 5;
        score = (pct / 100) * sectionMax;
      }
      break;
    }

    case 15: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    case 16: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    case 17: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (5 / 100) * sectionMax : 0;
      break;
    }

    case 18: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (10 / 100) * sectionMax : 0;
      break;
    }

    // Category 19: Institutional Services
    case 19: {
      const coord = Number(rawValue.instDeptServicesCoordinator || rawValue.coordinator_count || 0);
      const other = Number(rawValue.instDeptServicesOthers || rawValue.member_count || 0);

      if (coord > 0 || other > 0) {
        const coordScore = coord > 0 ? (0.20 * sectionMax) : 0;
        const otherScore = other > 0 ? (0.05 * sectionMax) : 0;
        score = coordScore + otherScore;
      } else {
        const role = String(rawValue.role || '');
        const count = rawValue.count !== undefined ? Number(rawValue.count) : 1;
        if (role === 'coordinator') score = count * (20 / 100) * sectionMax;
        else if (role === 'member') score = count * (5 / 100) * sectionMax;
      }
      break;
    }

    case 20: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (3 / 100) * sectionMax : 0;
      break;
    }

    case 21: {
      const count = Number(rawValue.count || 0);
      score = (count * 15 / 100) * sectionMax;
      break;
    }

    case 22: {
      const count = Number(rawValue.count || 0);
      score = count > 0 ? (2 / 100) * sectionMax : 0;
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
```
