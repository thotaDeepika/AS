# Faculty Appraisal & Increment Management System

> Ramaiah Institute of Technology, Bangalore

A comprehensive web-based system for managing annual faculty appraisals and increment processing with role-based access control, automated scoring, and multi-level review workflows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Express.js + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| Auth | JWT + bcrypt |

## Project Structure

```
├── client/          # React frontend (Vite)
├── server/          # Express backend
├── prisma/          # Prisma schema
├── docs/            # Project documentation
├── package.json     # Root workspace config
└── .env.example     # Environment template
```

## User Roles

1. **Faculty** — Submit appraisal applications with proof documents
2. **HOD** — Review departmental submissions, recommend/not-recommend
3. **Admin** — Route applications, assign reviewers, manage scoring config
4. **Reviewer** — Verify proofs and scoring for cross-department objectivity
5. **Principal** — Final approval and freeze
6. **Accounts** — View frozen applications for salary processing

## Getting Started

```bash
# 1. Clone
git clone https://github.com/27-MANISH/appraisal-system.git
cd appraisal-system

# 2. Install dependencies
npm install --workspaces
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Generate Prisma client
npx prisma generate --schema=./prisma/schema.prisma

# 5. Run development servers
npm run dev
```

## Default Login Credentials (Dev)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rit.edu | Admin@123 |
| Principal | principal@rit.edu | Admin@123 |
| HOD (CSE) | hod.cse@rit.edu | Admin@123 |
| Faculty | faculty1.cse@rit.edu | Admin@123 |
| Reviewer | reviewer.ece@rit.edu | Admin@123 |
| Accounts | accounts@rit.edu | Admin@123 |

## License

Private — Ramaiah Institute of Technology
