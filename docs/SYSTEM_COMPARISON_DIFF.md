# System Comparison & Architectural Diff Document
**Legacy College Appraisal System (`DATA/source.txt`, `DATA/cal.txt`) vs. Implemented System (`Software/`)**

---

## Executive Summary

This document provides a comprehensive side-by-side comparison between the legacy **Ramaiah Institute of Technology Self-Appraisal System** (contained in `DATA/source.txt` and `DATA/cal.txt`) and the newly **Implemented Self-Appraisal System** (located under `Software/`).

The legacy system was a basic JSP/HTML single-page web form powered by client-side jQuery script calculations. The newly implemented system is an enterprise-grade full-stack web application built using **React, TypeScript, Node.js (Express), Prisma ORM, and PostgreSQL**.

---

## 1. High-Level Architectural Comparison

| Dimension | Legacy System (`DATA/source.txt` & `cal.txt`) | Implemented System (`Software/`) |
| :--- | :--- | :--- |
| **Architecture** | Monolithic Java Servlet / JSP web application with embedded HTML and inline JavaScript scripts. | Decoupled Client-Server SPA Architecture (React + Vite Frontend REST API Server in Node.js/Express). |
| **Technology Stack** | HTML5, Bootstrap 3, jQuery 3.4.1, Java Servlets (JSP back-end script target `SubmitAppraisal`). | React 18, TypeScript, Tailwind CSS, Node.js, Express, Prisma ORM, PostgreSQL. |
| **Score Computation Engine** | **Client-Side Browser Execution** (`calculate_scor.js`). Calculations happen in the user's browser DOM on `change` events. | **Server-Side Engine** (`server/src/lib/scoreEngine.ts`). Scores are computed securely on the backend; inputs are sanitized and stored as raw data. |
| **Data Persistence** | Direct form POST submission (`formAppraisal`) to Java Servlet. No dynamic dynamic schema or audit snapshots. | PostgreSQL database managed via Prisma ORM with versioned migrations, relational integrity, and submission snapshots. |
| **Role-Based Access Control (RBAC)** | None visible in form source code (Single tier faculty submission view). | Robust multi-role RBAC: `FACULTY`, `REVIEWER`, `HOD`, `PRINCIPAL`, `ACCOUNTS`, `ADMIN`. |
| **Appraisal Workflow** | Single-step form print/submission. | Multi-stage Approval Pipeline: Draft → Submitted → Reviewer Evaluation → HOD Recommendation → Principal Approval → Accounts Verification. |
| **Rule Configuration** | Hardcoded logic in JavaScript (`cal.txt`). Rules cannot be changed without modifying JS source files. | Dynamic DB-driven rules (`ScoringCategory`, `ScoringRule`). Admins can configure weights, slabs, and rules per designation dynamically. |

---

## 2. Technical Stack & Security Comparison

### 2.1 Score Calculation Location & Audit Integrity
- **Legacy (`cal.txt`)**:
  - The calculations are triggered in the browser via jQuery bindings on input `change` events (`$("#fciScore").change(...)`).
  - Read-only DOM inputs (`#totalScore`, `#bonusScore`, `#finalScore`) can easily be edited or overridden by end-users using Browser Developer Tools before form submission.
  - Vulnerable to client-side data tampering.
- **Implemented (`Software/`)**:
  - The frontend collects raw faculty entries (counts, percentages, amounts).
  - Score engine (`scoreEngine.ts`) computes scores on the backend server.
  - Calculations are immutable and tamper-proof. Submissions create fixed snapshots retaining exact scoring rules active at submission time.

### 2.2 Security & Authentication
- **Legacy**: Plain form submit without session management, JWT, or audit log tracking built into the frontend script.
- **Implemented**: JWT authentication with bcrypt password hashing, HTTP-only secure cookie support, rate limiting, and action logs.

---

## 3. UI and Form Inputs Comparison

The form fields in `DATA/source.txt` correspond directly to the 23 categories in the implemented database schema (`ScoringCategory`):

| Sl. No. | Activity / Category | Legacy HTML Inputs (`source.txt`) | Implemented System Schema (`raw_value` JSON) |
| :--- | :--- | :--- | :--- |
| **1** | FCI Score | `<input id="fciScore">` | `{ fci_percentage: number, fci_entries: [...] }` |
| **2** | Refereed Journal Papers (SJR/Scopus/WoS) | `<input id="nirfJournals">` | `{ count: number, publications: [...] }` |
| **3** | Indexed Conference Papers | `<input id="indexedPapers">` | `{ count: number, papers: [...] }` |
| **4** | Non-refereed & Non-indexed Papers | `<input id="journalPublication">` | `{ count: number }` |
| **5** | Books & Book Chapters | `<input id="books">`, `<input id="booksChapters">` | `{ books: number, chapters: number }` |
| **6** | Disclosures Filed | `<input id="disclosuresFiled">` | `{ count: number }` |
| **7** | Patents Granted | `<input id="patentsGranted">` | `{ count: number }` |
| **8** | Research Guidance UG | `<input id="researchGuidanceUg">` | `{ count: number }` |
| **9** | Research Guidance Master's | `<input id="researchGuidanceMaster">` | `{ count: number }` |
| **10** | Research Guidance Ph.D. | `<input id="researchGuidancePhd">` | `{ count: number }` |
| **11** | Funded Projects | 4 inputs: `>=10L`, `5-10L`, `1-5L`, `<1L` | Slab calculation on total funding `amount_lakhs` or project list. |
| **12** | Consulting Projects | 4 inputs: `>=10L`, `5-10L`, `1-5L`, `<1L` | Slab calculation on total consulting `amount_lakhs` or project list. |
| **13** | Conference/Session Chair, Reviewer | `<input id="chairReviewer">` | `{ count: number }` |
| **14** | FDP/Workshop Organized | 2 inputs: `5 Days`, `3 Days` | `{ days: number }` or `{ five_day_count, three_day_count }` |
| **15** | Invited Talks Outside Institute | `<input id="invitedTalksOutside">` | `{ count: number }` |
| **16** | Events Participated Outside | `<input id="eventsOutside">` | `{ count: number }` |
| **17** | Events Participated Inside | `<input id="invitedTalksInside">` | `{ count: number }` |
| **18** | Industry Relations | `<input id="industryRelations">` | `{ count: number }` |
| **19** | Institutional / Dept Services (NBA/NIRF) | 2 inputs: `Coordinator`, `Others` | `{ role: 'coordinator' \| 'member', count: number }` |
| **20** | Other Services | `<input id="othServices">` | `{ count: number }` |
| **21** | Awards and Honours | `<input id="awardsHonours">` | `{ count: number }` |
| **22** | Professionalism / Team Spirit | `<input id="profTeam">` | `{ count: number }` |
| **23** | Any Other Major Contributions | `<textarea id="anyContribution">` | `{ text: string }` |

---

## 4. Key Advantages of Implemented System Over Legacy

1. **Tamper-Proof Verification**: Calculations are server-enforced, eliminating DOM manipulation exploits.
2. **Auditability & Traceability**: Reviewers, HODs, and Principals can review proof document attachments for each submitted item (Journals, Patents, Grants).
3. **Dynamic Rule Management**: Admin panel allows real-time updates to scoring rules, base weights, and category titles without code deployment.
4. **Comprehensive Workflow**: Multi-tier approvals replace the manual physical paper printout approval model.
5. **Analytics & Reporting**: Automatic PDF generation, department summary dashboards, and score export capabilities.
