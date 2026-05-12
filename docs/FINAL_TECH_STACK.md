# Technology Stack — Final

## Architecture

**Decoupled Monorepo** — Single repository containing both `client/` (React frontend) and `server/` (Express backend) as separate packages.

This architecture is chosen because:
- Clean separation of concerns
- Both can be containerized independently via Docker
- Easy local development (run both with one command)
- Fits intranet deployment where both run on the same server

---

## Frontend (`client/`)

| Technology | Purpose |
|-----------|---------|
| React 19 | UI library |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Tailwind CSS v4 | Utility-first styling |
| ShadCN UI | Pre-built accessible component library |
| React Hook Form | Performant form handling |
| Zod | Schema validation (shared with backend) |
| TanStack Table | Advanced data tables with sorting/filtering |
| React Router | Client-side routing |
| Axios | HTTP client for API calls |

---

## Backend (`server/`)

| Technology | Purpose |
|-----------|---------|
| Node.js | Runtime |
| Express.js | Web framework |
| TypeScript | Type safety |
| Prisma ORM | Database access & migrations |
| JSON Web Tokens (JWT) | Stateless authentication |
| bcrypt | Password hashing |
| Multer | File upload handling (PDF) |
| Zod | Request payload validation |
| Puppeteer | Server-side PDF report generation |

---

## Database

| Technology | Purpose |
|-----------|---------|
| PostgreSQL | Primary relational database |
| Supabase | Managed PostgreSQL hosting (cloud for dev, self-host for production) |

**Development**: Use Supabase cloud project (free tier) for easy setup — managed via Supabase MCP.
**Production**: Self-hosted Supabase via Docker on the college intranet server.

---

## ORM & Migrations

| Technology | Purpose |
|-----------|---------|
| Prisma | Schema definition, migrations, type-safe queries |
| Prisma MCP | Schema management via IDE tooling |

---

## File Storage

- Local server filesystem for PDF proof uploads
- File metadata stored in PostgreSQL
- PDF only, configurable max size

---

## DevOps & Tooling

| Technology | Purpose |
|-----------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration (frontend, backend, db) |
| GitHub | Source code repository |
| GitHub MCP | Repository management via IDE |
| Supabase MCP | Database management via IDE |
| Prisma MCP | ORM management via IDE |

---

## Reports

| Technology | Purpose |
|-----------|---------|
| Puppeteer | Generate PDF reports server-side |
| ExcelJS | Excel export support for Accounts department |

---

## API Style

- RESTful API architecture
- Consistent JSON response format: `{ success, data, error, message }`
- Zod validation on all endpoints
- JWT middleware on all protected routes

---

## Future Enhancements (Not in scope for v1)

- Email notifications (internal SMTP)
- Faculty resubmission toggle
- Analytics dashboard
