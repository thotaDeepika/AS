# 🎓 RIT Faculty Appraisal System

A comprehensive web-based faculty performance appraisal system designed for Rashtreeya Vidyalaya Institute of Technology (RVIT). Automates the entire appraisal lifecycle — from faculty self-assessment through HOD review, external review, Principal approval, and Accounts processing.

## ✨ Features

### Multi-Role Workflow
- **Faculty** — Submit appraisal forms with 23 scoring categories, upload proof documents
- **HOD** — Review and recommend/reject department applications
- **Reviewer** — External expert review with comments
- **Principal** — Final approval authority
- **Admin** — Full system management (users, scoring, workflow pipeline, audit logs)
- **Accounts** — Process approved appraisals for salary increments

### Core Capabilities
- 🔐 **JWT Authentication** with role-based access control (RBAC)
- 📊 **Automated Score Calculation** — 23 categories across Teaching, Research, Service
- 📄 **PDF Reports** — Individual appraisal forms + consolidated department reports
- 📈 **Excel Exports** — 3-sheet workbook with summary, detail, and category breakdown
- 🔍 **Audit Trail** — Full logging of all system actions
- 📁 **File Upload** — PDF proof documents per scoring category
- 🎨 **Dark Mode UI** — Premium design with animations and micro-interactions

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite |
| Styling | Vanilla CSS with design system, Inter font |
| Backend | Express.js + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| Auth | JWT (bcrypt + jsonwebtoken) |
| Reports | PDFKit (PDF), ExcelJS (Excel) |
| DevOps | Docker Compose |

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/27-MANISH/appraisal-system.git
cd appraisal-system
npm install && cd server && npm install && cd ../client && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env with your database credentials

# Database setup
npx prisma generate && npx prisma db push
npx tsx server/src/seed.ts

# Run
npm run dev
```

**Default login:** `admin@rit.edu` / `Admin@123`

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment instructions.

## 📂 Project Structure

```
├── client/                 # React + Vite frontend
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── context/        # Auth context
│       ├── lib/            # API client
│       └── pages/          # Route pages (10 pages)
├── server/                 # Express.js backend
│   └── src/
│       ├── lib/            # Prisma, errors, upload, score engine, report generator
│       ├── middleware/     # Auth, error handler
│       └── routes/         # Auth, users, departments, applications, reviews, admin, reports
├── prisma/                 # Schema & migrations
├── docs/                   # Architecture documentation
├── docker-compose.yml      # Local development containers
└── .env.example            # Environment template
```

## 📋 Appraisal Workflow

```
Faculty (Draft → Submit) → HOD Review → Admin Assigns Reviewer → Reviewer Review
    → Admin Forwards → Principal Approval → Admin Freezes → Accounts Processing
```

## 📖 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) — Setup, configuration, production deployment
- [Workflow](docs/FINAL_WORKFLOW.md) — Detailed appraisal workflow states
- [Scoring Rules](docs/FINAL_SCORING.md) — All 23 categories and designation rules
- [RBAC](docs/FINAL_RBAC.md) — Role permissions matrix
- [Database Schema](docs/FINAL_DB_SCHEMA.md) — Complete entity-relationship design

## 📄 License

This project is developed for RIT internal use.
