# Database Rules & Standards

## Database

- PostgreSQL database
- Managed through Prisma ORM
- Hosted using Supabase

---

# Naming Conventions

## Prisma Models
- Use PascalCase

Example:
- User
- Department
- Application

---

## Database Fields
- Use snake_case

Example:
- created_at
- updated_at
- final_score

---

# Primary Keys

- Use UUIDs for all primary keys

---

# Relationships

- Use explicit foreign key relationships
- Use cascading deletes only when required

---

# Workflow States

Use enums for:
- Roles
- Application states
- Review decisions

---

# Audit Logging

Every critical operation should create audit logs.

Track:
- User actions
- Login events
- Status changes
- Review actions
- File uploads

---

# File Upload Rules

- PDF only
- Maximum file size configurable
- Store file metadata in database

---

# Score Calculation Rules

- Scores must always be calculated in backend
- Frontend must never send final scores
- Calculation logic must remain centralized

---

# Security Rules

- Hash passwords using bcrypt
- Never store plain passwords
- Validate all uploads
- Protect all routes using JWT middleware

---

# API Standards

- Use RESTful API naming
- Validate all request payloads using Zod
- Return consistent response formats

---

# Migration Rules

- Use Prisma migrations only
- Avoid manual schema changes directly in production
