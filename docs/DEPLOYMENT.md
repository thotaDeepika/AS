# Deployment Guide — RIT Faculty Appraisal System

## Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ LTS | Runtime for frontend & backend |
| PostgreSQL | 15+ | Database (Supabase or self-hosted) |
| Docker | 24+ | Optional: containerized deployment |
| Git | 2.40+ | Source control |

---

## Quick Start (Docker)

The fastest way to run the entire system locally:

```bash
# 1. Clone the repository
git clone https://github.com/27-MANISH/appraisal-system.git
cd appraisal-system

# 2. Copy environment config
cp .env.example .env
# Edit .env with your database credentials

# 3. Start all services
docker-compose up --build

# Services will be available at:
# Frontend: http://localhost:5174
# Backend:  http://localhost:3001
# Database: localhost:5432
```

---

## Manual Setup

### 1. Install Dependencies

```bash
# Root (workspace)
npm install

# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Configure Environment

Create `.env` in the project root:

```env
# Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_HOST.supabase.co:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_HOST.supabase.co:5432/postgres"

# Auth
JWT_SECRET="your-secure-random-secret-min-32-chars"
JWT_EXPIRES_IN="8h"

# Server
PORT=3001
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"

# Upload
UPLOAD_MAX_SIZE="10485760"
UPLOAD_DIR="./uploads"
```

### 3. Database Setup

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed initial data (departments, users, scoring categories, rules)
npx tsx server/src/seed.ts
```

### 4. Run Development

```bash
# Start both client and server (from root)
npm run dev

# Or individually:
cd server && npm run dev    # Backend on :3001
cd client && npm run dev    # Frontend on :5173
```

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rit.edu | Admin@123 |
| Principal | principal@rit.edu | Admin@123 |
| HOD (CSE) | hod.cse@rit.edu | Admin@123 |
| Faculty (CSE) | faculty.cse@rit.edu | Admin@123 |
| Reviewer | reviewer@rit.edu | Admin@123 |
| Accounts | accounts@rit.edu | Admin@123 |

> ⚠️ **Change all default passwords immediately after first login.**

---

## Production Deployment

### Option 1: Reverse Proxy with Nginx

```nginx
server {
    listen 80;
    server_name appraisal.rit.edu;

    # Frontend (static build)
    location / {
        root /var/www/appraisal/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploaded files
    location /uploads/ {
        alias /var/www/appraisal/uploads/;
    }
}
```

### Option 2: Docker Compose (Production)

```bash
# Build production images
docker-compose -f docker-compose.yml up -d --build

# Run migrations
docker exec appraisal-server npx prisma db push
docker exec appraisal-server npx tsx src/seed.ts
```

### Build Frontend for Production

```bash
cd client
npm run build
# Output in client/dist/
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Nginx / Reverse Proxy               │
│                      (Port 80/443)                    │
├───────────────────────┬─────────────────────────────┤
│   Static Files (/)     │   API Proxy (/api/*)         │
│   client/dist/         │   → localhost:3001            │
├───────────────────────┴─────────────────────────────┤
│              Express.js Backend (Port 3001)            │
│   ┌─────────┬──────────┬────────────┬──────────┐     │
│   │ Auth    │ Apps     │ Reports   │ Admin    │     │
│   │ Routes  │ Routes   │ Routes    │ Routes   │     │
│   └─────────┴──────────┴────────────┴──────────┘     │
│              Prisma ORM + Score Engine                 │
├─────────────────────────────────────────────────────┤
│            PostgreSQL (Supabase / Self-hosted)         │
│      departments, users, applications, reviews,       │
│      scoring_categories, scoring_rules, audit_logs    │
└─────────────────────────────────────────────────────┘
```

---

## API Endpoints Reference

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | /api/auth/login | JWT login | All |
| GET | /api/auth/me | Current user | Authenticated |
| GET | /api/users | List users | Admin |
| POST | /api/users | Create user | Admin |
| GET | /api/applications | List applications | Role-filtered |
| POST | /api/applications | Create application | Faculty |
| POST | /api/applications/:id/submit | Submit for review | Faculty |
| POST | /api/reviews/:id | Submit review | HOD, Reviewer, Principal |
| GET | /api/admin/stats | Dashboard stats | Admin |
| POST | /api/admin/assign-reviewer | Assign reviewer | Admin |
| GET | /api/reports/appraisal/:id/pdf | Individual PDF | Faculty+, Admin |
| GET | /api/reports/consolidated/pdf | Consolidated PDF | Admin, Principal, Accounts |
| GET | /api/reports/consolidated/excel | Excel export | Admin, Principal, Accounts |

---

## Troubleshooting

### Prisma EPERM Error
If `npx prisma generate` fails with `EPERM`, kill all running node processes first:
```bash
taskkill /f /im node.exe   # Windows
killall node               # Linux/Mac
```

### Port Already in Use
```bash
# Find process on port
netstat -ano | findstr :3001   # Windows
lsof -i :3001                 # Linux/Mac
```

### Database Connection
- Ensure your IP is whitelisted in Supabase dashboard
- Verify `DATABASE_URL` uses the pooler connection string
- Verify `DIRECT_URL` uses the direct connection string

### File Upload Issues
- Ensure `uploads/` directory exists and is writable
- Maximum file size is 10MB (configurable via `UPLOAD_MAX_SIZE`)
- Only PDF files are accepted for proof documents
