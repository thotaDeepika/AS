# 🎓 RIT Faculty Appraisal System

A full-stack web application for managing the faculty performance appraisal lifecycle at Ramaiah Institute of Technology (RIT). The system automates the entire appraisal pipeline — from faculty self-assessment and proof-document upload through multi-stage review (HOD → Reviewer → Principal) to final Accounts processing.

---

## ✨ Features

### 🔄 Multi-Stage Appraisal Workflow
The system implements a **8-stage pipeline** that mirrors the real institutional process:

```
Faculty (Draft → Submit) → HOD Review → Admin Assigns Reviewer
   → Reviewer Review → Admin Forwards → Principal Approval
   → Admin Freezes → Accounts Processing
```

Each stage enforces role-based permissions — only the authorized role can advance an application to the next step.

### 👥 Role-Based Dashboards (6 Roles)

| Role | Capabilities |
|------|-------------|
| **Faculty** | Create appraisals, fill 23 scoring categories, upload PDF proofs, track status |
| **HOD** | Review department applications, recommend or reject with comments |
| **Reviewer** | External expert review of assigned applications |
| **Principal** | Final approval authority, view consolidated department summaries |
| **Admin** | Full system management — users, scoring config, reviewer assignment, audit logs |
| **Accounts** | Process approved appraisals, mark as sent to accounts for salary increments |

### 📊 Automated Scoring Engine
- **23 categories** across 3 sections: Teaching (1), Research (11), Service (11)
- Scoring rules are **designation-aware** — different weightages for Assistant Professor, Associate Professor, and Professor
- **Bonus Multipliers** — Scores for specific high-value research and funding categories (2, 7, 10, 11) are automatically doubled.
- Scores calculated automatically based on faculty input and configurable formulas
- Per-category max weightage enforcement

### 📁 Document Management
- **Multi-file PDF upload** per category (up to 5 files per category)
- Files stored on server disk at `./uploads/` with unique filenames
- Max file size: 10MB (configurable via `.env`)

### 📄 Report Generation
- **Individual PDF Reports** — Auto-generated 2-part official document (Summary Form + Detailed Information Annexure). Features dynamic rendering of faculty data, review history, and verified digital signatures (image or text hash) for the HoD, Reviewer, and Principal.
- **Consolidated Excel Reports** — 3-sheet workbook (Summary, Detail, Category Breakdown) for departments or entire institution
- Available to Admin, Principal, and Accounts roles

### 🔍 Full Audit Trail
- Every action logged — logins, submissions, reviews, status changes
- Filterable audit log page for Admin
- Includes IP address, user info, and detailed JSON payloads

### 🎨 Dark & Light Theme
- **Dark mode** (default) — Premium dark UI with indigo accents
- **Light mode** — Clean white theme for daylight use
- Toggle in the header, preference saved in browser localStorage

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite |
| **Styling** | Vanilla CSS with custom design system, Inter font (Google Fonts) |
| **Backend** | Express.js + TypeScript |
| **ORM** | Prisma |
| **Database** | PostgreSQL (Supabase-hosted or local Docker) |
| **Authentication** | JWT (bcrypt for password hashing, jsonwebtoken for tokens) |
| **File Upload** | Multer (disk storage) |
| **PDF Reports** | PDFKit |
| **Excel Reports** | ExcelJS |
| **DevOps** | Docker Compose (PostgreSQL + Server + Client) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **PostgreSQL** database (or use Docker Compose / Supabase)
- **npm** (comes with Node.js)

### Option 1: Local Development (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/27-MANISH/appraisal-system.git
cd appraisal-system

# 2. Install all dependencies (root + client + server workspaces)
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL database URL and JWT secret

# 4. Set up the database
npx prisma generate
npx prisma db push

# 5. Seed the database with categories, scoring rules, and a default admin
npx tsx server/src/seed.ts

# 6. Start development servers (client + server concurrently)
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Option 2: Docker Compose

```bash
# Start all services (PostgreSQL + Backend + Frontend)
docker-compose up --build

# In another terminal, seed the database
docker exec appraisal-server npx tsx src/seed.ts
```

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@rit.edu` | `Admin@123` |

> After logging in as Admin, use the **User Management** page to create faculty, HOD, reviewer, principal, and accounts users.

---

## 📂 Project Structure

```
appraisal-system/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── AppLayout.tsx    # Main layout with sidebar, header, theme toggle
│   │   │   ├── DataTable.tsx    # Sortable, searchable data table
│   │   │   ├── FileUpload.tsx   # Drag-and-drop file upload (multi-file)
│   │   │   ├── ScoreCard.tsx    # Score display with progress bar
│   │   │   └── StatusBadge.tsx  # Color-coded status pills
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # JWT auth state management
│   │   ├── lib/
│   │   │   └── api.ts           # Axios API client with interceptors
│   │   ├── pages/               # 11 route pages
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ApplicationsPage.tsx
│   │   │   ├── ReviewsPage.tsx
│   │   │   ├── UsersPage.tsx
│   │   │   ├── ScoringPage.tsx
│   │   │   ├── AssignReviewersPage.tsx
│   │   │   ├── PrincipalDashboardPage.tsx
│   │   │   ├── AccountsDashboardPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   └── AuditLogsPage.tsx
│   │   ├── App.tsx              # Router setup with protected routes
│   │   ├── main.tsx             # Entry point
│   │   └── index.css            # Complete design system (dark + light themes)
│   ├── index.html
│   └── vite.config.ts
│
├── server/                      # Express.js backend
│   ├── src/
│   │   ├── lib/
│   │   │   ├── prisma.ts        # Prisma client singleton
│   │   │   ├── errors.ts        # Custom error classes
│   │   │   ├── upload.ts        # Multer configuration
│   │   │   ├── scoreEngine.ts   # Automated score calculation engine
│   │   │   └── reportGenerator.ts # PDF & Excel report generation
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT verification + role guards
│   │   │   └── errorHandler.ts  # Global error handling
│   │   ├── routes/
│   │   │   ├── auth.ts          # Login/logout/me endpoints
│   │   │   ├── users.ts         # CRUD for user management
│   │   │   ├── departments.ts   # Department listing
│   │   │   ├── applications.ts  # Full application lifecycle API
│   │   │   ├── reviews.ts       # Review submission endpoints
│   │   │   ├── admin.ts         # Scoring config, reviewer assignment, audit logs
│   │   │   └── reports.ts       # PDF/Excel generation endpoints
│   │   ├── index.ts             # Express app setup, CORS, routes
│   │   └── seed.ts              # Database seeder (categories + rules + admin)
│   ├── Dockerfile
│   └── package.json
│
├── prisma/
│   └── schema.prisma            # Database schema (9 models, 7 enums)
│
├── docs/                        # Architecture documentation
│   ├── FINAL_SCORING.md         # All 23 categories and designation rules
│   ├── FINAL_WORKFLOW.md        # Detailed appraisal workflow states
│   ├── FINAL_RBAC.md            # Role permissions matrix
│   ├── FINAL_DB_SCHEMA.md       # Complete entity-relationship design
│   ├── FACULTY_APPLICATION_FIELDS.md  # Form fields and input types
│   ├── DEPLOYMENT.md            # Setup, configuration, production deployment
│   └── ...                      # Additional design documents
│
├── docker-compose.yml           # PostgreSQL + Server + Client containers
├── .env.example                 # Environment variable template
├── .gitignore
└── package.json                 # Monorepo workspace config
```

---

## 🗄️ Database Schema

The system uses **9 models** in PostgreSQL via Prisma:

| Model | Purpose |
|-------|---------|
| `Department` | Academic departments (CSE, ISE, ECE, etc.) |
| `User` | All users with role, designation, and department |
| `Application` | Faculty appraisal submissions per academic year |
| `ScoringCategory` | 23 scoring categories (Teaching / Research / Service) |
| `ScoringRule` | Per-category, per-designation weightage and formula |
| `CategoryEntry` | Faculty input values per category per application |
| `ProofDocument` | Uploaded PDF proof files linked to category entries |
| `Review` | Review decisions and comments from HOD/Reviewer/Principal |
| `AuditLog` | Full action log with user, action, entity, and metadata |

### Key Relationships
- A **User** belongs to a **Department**
- An **Application** belongs to a **User** (faculty) and optionally has an assigned **Reviewer**
- Each **Application** has many **CategoryEntries** (one per scoring category filled)
- Each **CategoryEntry** can have multiple **ProofDocuments** (PDF uploads)
- **ScoringRules** define max weightage per category per designation

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database (PostgreSQL connection strings)
DATABASE_URL="postgresql://..."       # Pooled connection (for Prisma queries)
DIRECT_URL="postgresql://..."         # Direct connection (for migrations)

# JWT Authentication
JWT_SECRET="your-secret-key"          # Change this in production!
JWT_EXPIRES_IN="24h"

# Server
PORT=3001
CLIENT_URL="http://localhost:5173"    # CORS origin
NODE_ENV="development"

# File Upload
UPLOAD_DIR="./uploads"                # Where PDFs are stored on disk
MAX_FILE_SIZE_MB=10                   # Maximum upload size per file
```

---

## 📋 Scoring System

The appraisal form consists of **23 categories** divided into 3 sections:

| Section | Categories | Description |
|---------|-----------|-------------|
| **Teaching** | 1 category | Teaching load assessment |
| **Research** | 11 categories | Publications, patents, funded projects, PhD guidance, etc. |
| **Service** | 11 categories | Administrative roles, committee work, extension activities, etc. |

Each category has **designation-specific scoring rules**:
- Different max weightage for Assistant Professor, Associate Professor, and Professor
- Configurable formulas (per-unit scoring, boolean flags, numerical inputs)

For the complete breakdown, see [docs/FINAL_SCORING.md](docs/FINAL_SCORING.md).

---

## 🔐 Authentication & Authorization

- **JWT-based authentication** — tokens issued on login, validated on every API call
- **Role-based access control (RBAC)** — 6 roles with distinct permissions
- **Middleware guards** — `requireAuth()` and `requireRole(...)` on every route
- **Password hashing** — bcrypt with salt rounds

For the full permissions matrix, see [docs/FINAL_RBAC.md](docs/FINAL_RBAC.md).

---

## 📖 API Endpoints

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/api/auth/login` | Login | Public |
| `GET` | `/api/auth/me` | Current user info | All |
| `GET/POST` | `/api/users` | List / Create users | Admin |
| `GET` | `/api/departments` | List departments | All |
| `GET/POST` | `/api/applications` | List / Create applications | Faculty, Admin, HOD, etc. |
| `PATCH` | `/api/applications/:id/submit` | Submit application | Faculty |
| `POST` | `/api/applications/:id/entries` | Save category entry | Faculty |
| `POST` | `/api/applications/:id/upload` | Upload proof document | Faculty |
| `POST` | `/api/reviews` | Submit review | HOD, Reviewer, Principal |
| `PATCH` | `/api/admin/applications/:id/assign-reviewer` | Assign reviewer | Admin |
| `PATCH` | `/api/admin/applications/:id/freeze` | Freeze application | Admin |
| `PATCH` | `/api/admin/applications/:id/send-to-accounts` | Send to accounts | Admin |
| `GET` | `/api/admin/scoring-categories` | List scoring config | Admin |
| `GET` | `/api/admin/audit-logs` | View audit trail | Admin |
| `GET` | `/api/reports/individual/:id` | Download individual PDF | Admin, Principal, Accounts |
| `GET` | `/api/reports/consolidated` | Download Excel report | Admin, Principal, Accounts |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/DEPLOYMENT.md) | Setup, configuration, and production deployment |
| [Appraisal Workflow](docs/FINAL_WORKFLOW.md) | Detailed 8-stage workflow with status transitions |
| [Scoring Rules](docs/FINAL_SCORING.md) | All 23 categories, designation rules, and formulas |
| [RBAC Permissions](docs/FINAL_RBAC.md) | Role-based permissions matrix |
| [Database Schema](docs/FINAL_DB_SCHEMA.md) | Complete ER design with field descriptions |
| [Form Fields](docs/FACULTY_APPLICATION_FIELDS.md) | All 23 form fields, input types, and validation |

---

## 🐳 Docker Deployment

The `docker-compose.yml` provides a complete local environment:

```bash
# Start everything
docker-compose up --build -d

# Check logs
docker-compose logs -f server

# Seed the database
docker exec appraisal-server npx tsx src/seed.ts

# Stop
docker-compose down
```

**Services:**
- `db` — PostgreSQL 16 Alpine on port 5432
- `server` — Express API on port 3001
- `client` — Vite dev server on port 5173

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is developed for Ramaiah Institute of Technology (RIT) internal use.
