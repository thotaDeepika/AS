# Faculty Appraisal & Increment Management System

## Overview
This project is an intranet-based Faculty Appraisal and Increment Management System developed for managing the annual appraisal workflow of teaching staff.

The system digitizes the traditional appraisal process by introducing a centralized workflow platform with role-based access control, automatic score calculations, approval lifecycle tracking, document uploads, and reporting features.

The system is intended for deployment inside the college intranet and will not be publicly accessible.

---

# Objectives

- Eliminate paper-based appraisal workflows
- Automate score calculations
- Maintain transparent approval workflows
- Enable document verification through uploaded proofs
- Generate consolidated reports for accounts and administration
- Maintain audit logs and workflow history
- Improve operational efficiency for appraisal processing

---

# User Roles

1. Faculty
2. HOD
3. Reviewer
4. Principal
5. Admin
6. Accounts Department

---

# Core Workflow

Faculty Submission
→ HOD Review
→ Reviewer Assignment by Admin
→ Reviewer Verification
→ Principal Approval
→ Freeze
→ Accounts Processing

---

# Core Features

- Role-Based Access Control (RBAC)
- Faculty appraisal submission
- Automatic score calculation
- PDF proof uploads
- HOD review workflow
- Reviewer assignment and verification
- Principal approval and freeze workflow
- Admin dashboard
- Accounts reporting
- Search and filtering
- PDF export
- Audit logging

---

# Deployment Model

- Internal college intranet only
- Desktop-first application
- No external internet access required

---

# Technology Stack

## Frontend
- React
- TypeScript
- Tailwind CSS
- ShadCN UI

## Backend
- Node.js
- Express.js
- Prisma ORM
- JWT Authentication

## Database
- PostgreSQL (Supabase)

## Storage
- Local PDF storage

## Deployment
- Docker
- Docker Compose
