# Scoring System — Final

Based on the Ramaiah Institute of Technology "Guidelines for Annual Increment for Teaching Staff".

## Scoring Sections

The appraisal form has **3 main sections** with different maximum weightages per designation:

| Section | Asst. Prof Max | Assoc. Prof Max | Professor Max |
|---------|---------------|-----------------|---------------|
| Teaching | 60 | 50 | 40 |
| Research | 10 | 20 | 30 |
| Service & Professional Development | 30 | 30 | 30 |
| **Total** | **100** | **100** | **100** |

---

## Category 1: FCI Score (Teaching)

**Field**: Average FCI Score of all courses handled (percentage)

| FCI Score Range | Score (% of Teaching weightage) |
|----------------|-------------------------------|
| >= 85% | 100% |
| >= 80% and < 85% | 90% |
| >= 75% and < 80% | 80% |
| >= 70% and < 75% | 70% |
| < 70% | 40% |

**Example**: Asst. Prof with FCI 82% → 90% of 60 = 54 points
 1 attachment option
---

## Categories 2-12: Research

### 2. No of Non-paid Refereed Journal Papers in SJR/Scopus/Web of Science
- Faculty must be one among first 3 authors
- **1 paper = 100% of research weightage**
 2 attachment option
### 3. No of Indexed Conference Papers in SJR/Scopus/Web of Science
- Faculty must be one among first 3 authors
- Designation-based:
  - Asst. Professor: 1 paper = 50%
  - Assoc. Professor: 1 paper = 25%
  - Professor: 1 paper = 20%
2 attachments option
### 4. No of Non-paid Non-refereed Journals and Non-indexed Conferences
- Faculty must be one among first 3 authors
- **10% of research weightage**
2 attachments option
### 5. Books/Chapters
- Faculty must be one among first 3 authors
- 1 book = 50%
- 1 book chapter = 20%
 1 attachment option

### 6. Disclosures Filed
- 1 disclosure = 10%
 1 attachment option

### 7. Patents Granted
- 1 patent = 50%
 1 attachment option

### 8. Research Guidance UG
- 1 batch = 1%
 1 attachment option

### 9. Research Guidance PG
- 1 batch = 3%
 1 attachment option

### 10. Research Guidance PhD
- 1 batch = 7%
 1 attachment option

### 11. Funded Projects
| Funding Amount | Score (% of research weightage) |
|---------------|-------------------------------|
| >= 10 Lakhs | 100% |
| >= 5 Lakhs and < 10 Lakhs | 50% |
| >= 1 Lakh and < 5 Lakhs | 30% |
| < 1 Lakh | 20% |
 1 attachment option

### 12. Consulting Projects
| Funding Amount | Score (% of research weightage) |
|---------------|-------------------------------|
| >= 10 Lakhs | 100% |
| >= 5 Lakhs and < 10 Lakhs | 60% |
| >= 1 Lakh and < 5 Lakhs | 50% |
| < 1 Lakh | 20% |
 1 attachment option

---

## Categories 13-23: Service & Professional Development

*Max weightage varies by designation (Asst. Prof = 30, Assoc. Prof = 30, Prof = 30)*

### 13. Conference Chair, Session Chair, Reviewer of Q1/Q2 Journal
- 5% of service weightage
 1 attachment option

### 14. FDP/Seminar/Workshop organized as coordinator
- 5 days = 10%
- 3 days = 5%
 1 attachment option
### 15. Invited Technical Talks outside the Institute
- 10% of service weightage
 1 attachment option

### 16. Events Participated Outside Institute (FDP/Seminar/Workshop/Conference)
- 10% of service weightage
 1 attachment option

### 17. Events Participated Inside Institute (FDP/Seminar/Workshop/Conference)
- 5% of service weightage
 1 attachment option

### 18. Industry Relations (MoU, Co-hosted event, Technical Talk Series)
- 10% of service weightage
 1 attachment option

### 19. Institutional/Departmental Services (NBA/NIRF)
- Coordinator: 20% per service (multiplied by count)
- Others: 5% per service (multiplied by count)
 1 attachment option

### 20. Other Services to Institution or Society Contribution
- 3% of service weightage
 1 attachment option

### 21. Awards and Honours
- 1 event = 15%
 1 attachment option

### 22. Professionalism / Team Spirit
- 2% of service weightage
 1 attachment option

### 23. Any Other Major Contributions
- Free text (max 500 characters), no automatic scoring
 1 attachment option

---

## Score Calculation Rules

1. All scores are calculated **on the backend only**
2. Frontend sends **raw values** (number of papers, FCI %, funding amounts)
3. Backend looks up `ScoringRule` for the faculty's `designation` + `category`
4. Backend applies the formula/slab logic to compute each category score
5. Each category's score = `(percentage from formula) × section base multiplier` for the faculty's designation
6. Section base multipliers (NOT caps): Teaching (AP=60, AssoP=50, Prof=40), Research (AP=10, AssoP=20, Prof=30), Service (all=30)
7. Research & Service scores are **additive** — each category independently contributes `base × percentage`, and all are summed with **no cap**
8. `total_score = Teaching + Research + Service` (no cap — total can exceed 100)
9. `final_score = total_score + bonus` (bonus is optional, entered at principal/admin level)
10. Scoring rules are **admin-configurable** — stored in `ScoringCategory` + `ScoringRule` tables

---

## Dynamic Configuration

The Admin can modify:
- Category names and descriptions
- Input types and sub-fields
- Scoring slabs and percentages per designation
- Maximum weightages per section
- Enable/disable categories

All changes apply to **new** appraisal cycles only; existing submitted applications retain their original scoring rules (snapshot at submission time).
