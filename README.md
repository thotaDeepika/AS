# 🎓 Ramaiah Institute of Technology - Faculty Appraisal System

![License](https://img.shields.io/badge/License-Proprietary-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)

An enterprise-grade, full-stack web application architected to digitize and automate the faculty performance appraisal lifecycle at **Ramaiah Institute of Technology (RIT)**. The platform orchestrates the complete appraisal pipeline—from faculty self-assessment and secure proof-document upload through a strict multi-stage peer and administrative review process, concluding with verified Accounts processing.

---

## 🌟 Key Features

### 🔄 Multi-Stage Lifecycle Engine
The platform encodes the institution's official appraisal policies into a rigid **8-stage state machine**:
```mermaid
graph LR
    A[Faculty Draft] --> B[HOD Review]
    B --> C[Admin Assigns Reviewer]
    C --> D[Peer Review]
    D --> E[Admin Forwards]
    E --> F[Principal Approval]
    F --> G[Admin Freezes]
    G --> H[Accounts Processing]
```
Each transition enforces strict Role-Based Access Control (RBAC), ensuring that applications can only be advanced or reverted by the legally authorized role for that specific stage.

### 🛡️ Role-Based Architecture (RBAC)
The system is divided into 6 distinct organizational roles, each featuring personalized dashboards and restricted data access matrices:
- **👨‍🏫 Faculty:** Draft self-assessments, populate 23 scoring metrics, securely upload PDF proofs, and monitor application progress.
- **🧑‍💼 HOD (Head of Department):** Evaluate departmental applications, append official comments, and issue primary recommendations or reversions.
- **🕵️ Reviewer:** External domain experts who perform secondary audits on assigned applications.
- **🏛️ Principal:** The ultimate approving authority with access to high-level departmental analytics and consolidated scoring matrices.
- **⚙️ Admin:** Master system controllers managing user provisioning, scoring configurations, reviewer assignments, and complete audit trail oversight.
- **💼 Accounts:** Financial processors authorized to view frozen, approved applications to trigger salary increments.

### 📊 Dynamic Scoring & Analytics Engine
A sophisticated backend calculation engine evaluates faculty inputs against institutional rubrics:
- **Comprehensive Metrics:** 23 distinct categories across 3 sections (Teaching, Research, Service).
- **Designation-Aware Logic:** Automatically scales weightages and max-caps based on whether the faculty is an Assistant Professor, Associate Professor, or Professor.
- **Bonus Multipliers:** Core institutional priorities (e.g., Q1/Q2 Indexed Journals, Funded Projects, PhD Guidance, Patents) automatically receive a `2x` score multiplier to incentivize high-value academic output.
- **Real-time Evaluation:** Scores are instantly calculated and capped according to the dynamic `ScoringRules` tables in the database.

### 📄 Advanced Reporting & Document Generation
- **Official 2-Part PDF Portfolios:** Automatically compiles a high-fidelity PDF report featuring an Official Summary Form and a Detailed Annexure. Automatically injects verified digital signatures (image-based or cryptographic hash fallbacks) from the HOD, Reviewer, and Principal.
- **Consolidated Excel Exports:** Generates multi-sheet Excel workbooks detailing institutional and departmental summaries, empowering the Principal and Accounts teams with actionable analytics.

### 🔒 Security & Audit Compliance
- **Cryptographic Authentication:** JWT-based stateless authentication with `bcrypt` password hashing.
- **Immutable Audit Trail:** Every state transition, login, and administrative action is permanently logged with IP tracking, JSON payload snapshots, and timestamping.
- **Secure File Storage:** Proof documents are sanitized and stored securely via Multer, with strict MIME-type validation and a 10MB per-file configurable ceiling.

---

## 🛠️ Technology Stack

**Frontend Architecture:**
- **Core:** React 18, TypeScript, Vite
- **Styling:** Custom Vanilla CSS Design System with CSS Variables, native Dark/Light mode support, and Inter typography.
- **Routing & State:** React Router DOM, Context API.

**Backend Infrastructure:**
- **Server:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma (Type-safe database client)
- **Utilities:** `pdfkit` (Report Generation), `exceljs` (Analytics Exports), `multer` (File handling), `jsonwebtoken` (Auth).

**DevOps & Deployment:**
- Docker & Docker Compose (Containerized DB, Server, and Client)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher) or Docker Desktop
- **Git**

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/27-MANISH/appraisal-system.git
   cd appraisal-system
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

3. **Environment Configuration**
   Copy the example environment file and configure your local credentials:
   ```bash
   cp .env.example .env
   ```
   *Ensure you update the `DATABASE_URL` with your valid PostgreSQL connection string.*

4. **Database Migration & Seeding**
   Provision the database schema and inject the default scoring rules and admin account:
   ```bash
   npx prisma generate
   npx prisma db push
   npx tsx server/src/seed.ts
   ```

5. **Launch Application**
   Boot both the frontend and backend concurrently:
   ```bash
   npm run dev
   ```
   - **Frontend:** `http://localhost:5173`
   - **Backend API:** `http://localhost:3001`

### Docker Deployment
For an isolated environment, utilize the provided Docker Compose configuration:
```bash
# Boot the containerized environment in detached mode
docker-compose up --build -d

# Seed the database within the running server container
docker exec appraisal-server npx tsx src/seed.ts
```

### Default System Access
The seeder creates a master administrative account. Use this account to provision other roles.
- **Email:** `admin@rit.edu`
- **Password:** `Admin@123`

---

## 🗄️ Database Architecture

The system leverages a robust relational schema managed by Prisma:

- `User` / `Department`: Organizational hierarchy mapping.
- `Application` / `CategoryEntry` / `ProofDocument`: The core appraisal payload, linking faculty input directly to physical uploaded proofs.
- `ScoringCategory` / `ScoringRule`: The dynamic configuration engine that defines max scores and multipliers per designation.
- `Review`: Stores the chain of approval, comments, decisions, and digital signatures.
- `AuditLog`: The immutable ledger of system activity.

*(For the complete Entity-Relationship diagrams, refer to `docs/FINAL_DB_SCHEMA.md`)*

---

## 📖 Official Documentation Directory

The `docs/` folder contains the official architectural blueprints:

1. **[FINAL_WORKFLOW.md](docs/FINAL_WORKFLOW.md)** - Detailed mapping of the 8-stage state machine.
2. **[FINAL_SCORING.md](docs/FINAL_SCORING.md)** - Mathematical formulas and designation weightages for all 23 categories.
3. **[FINAL_RBAC.md](docs/FINAL_RBAC.md)** - The strict Role-Based Access Control matrix.
4. **[FINAL_DB_SCHEMA.md](docs/FINAL_DB_SCHEMA.md)** - Database ER models.
5. **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production hardening and deployment guidelines.

---

## 🤝 Contributing & Maintenance
This repository is maintained by the RIT Development Team. To contribute:
1. Create a descriptive feature branch (`git checkout -b feat/your-feature-name`).
2. Adhere to the existing TypeScript interfaces and Prisma schemas.
3. Submit a Pull Request targeting the `main` branch.

## 📄 License
This software is proprietary and developed exclusively for the internal operations of **Ramaiah Institute of Technology**. All rights reserved.
