# Database Schema & Rules — Final

## Database

- **Engine**: PostgreSQL
- **Hosting**: Supabase (cloud for dev, self-hosted Docker for production)
- **ORM**: Prisma
- **Migrations**: Prisma Migrate only — no manual schema changes

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Prisma Models | PascalCase | `User`, `Department`, `Application` |
| Database Fields | snake_case | `created_at`, `total_score`, `file_path` |
| Enums | UPPER_SNAKE_CASE | `HOD_REVIEWED`, `FACULTY`, `RECOMMENDED` |

---

## Primary Keys

- **All tables use UUIDs** as primary keys (`@default(uuid())` in Prisma)

---

## Enums

### Role
```
FACULTY | HOD | REVIEWER | PRINCIPAL | ADMIN | ACCOUNTS
```

### Designation
```
ASSISTANT_PROFESSOR | ASSOCIATE_PROFESSOR | PROFESSOR
```

### ApplicationStatus
```
DRAFT | REVERTED | SUBMITTED | HOD_REVIEWED | REVIEWER_ASSIGNED | REVIEWER_REVIEWED | PRINCIPAL_REVIEWED | FROZEN | SENT_TO_ACCOUNTS
```

### ReviewDecision
```
RECOMMENDED | NOT_RECOMMENDED | APPROVED | REJECTED | REVERTED
```

### AuditAction
```
LOGIN | LOGOUT | APPLICATION_CREATED | APPLICATION_SUBMITTED | APPLICATION_REVIEWED | REVIEWER_ASSIGNED | APPLICATION_FROZEN | SENT_TO_ACCOUNTS | FILE_UPLOADED | COMMENT_ADDED | USER_CREATED | USER_UPDATED | SCORING_CONFIG_UPDATED | APPLICATION_HOD_REVIEWED | APPLICATION_REVIEWER_REVIEWED | APPLICATION_PRINCIPAL_REVIEWED | STATUS_CHANGED
```

---

## Tables (Prisma Models)

### User
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | Unique |
| password_hash | String | bcrypt hashed |
| name | String | Full name |
| role | Role (Enum) | |
| designation | Designation (Enum) | Nullable (only for Faculty) |
| department_id | UUID | FK to Department (nullable) |
| is_active | Boolean | Default true |
| joining_date | DateTime | Nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

### Department
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Unique |
| code | String | Short code (e.g., "CSE", "ECE") (unique) |
| created_at | DateTime | |
| updated_at | DateTime | |

### Application
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| faculty_id | UUID | FK to User |
| academic_year | String | e.g., "2025-2026" (unique with faculty_id) |
| status | ApplicationStatus (Enum) | |
| total_score | Decimal | Calculated on backend (auto-calculated) |
| bonus_score | Decimal | Nullable |
| reviewer_score | Decimal | Nullable (override by Reviewer) |
| final_score | Decimal | total + bonus |
| submitted_at | DateTime | Nullable |
| frozen_at | DateTime | Nullable |
| reviewer_id | UUID | FK to User (nullable, set by Admin) |
| created_at | DateTime | |
| updated_at | DateTime | |

### CategoryEntry
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| application_id | UUID | FK to Application |
| category_id | UUID | FK to ScoringCategory |
| raw_value | JSON | The faculty's input values |
| calculated_score | Decimal | Backend-calculated score |
| reviewer_score | Decimal | Nullable (override score set by Reviewer) |
| created_at | DateTime | |
| updated_at | DateTime | |

### ProofDocument
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| category_entry_id | UUID | FK to CategoryEntry |
| file_name | String | Original filename |
| file_path | String | Server storage path |
| file_size | Integer | Bytes |
| mime_type | String | Must be application/pdf |
| item_index | Integer | Index of sub-item (nullable) |
| uploaded_at | DateTime | |

### Review
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| application_id | UUID | FK to Application |
| reviewer_user_id | UUID | FK to User (who reviewed) |
| role_at_review | Role (Enum) | HOD / REVIEWER / PRINCIPAL |
| decision | ReviewDecision (Enum) | |
| comments | Text | Nullable |
| signature_path | String | Path to review signature file (nullable) |
| reviewed_at | DateTime | |

### ScoringCategory
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| sl_no | Integer | Display order (1-23) |
| section | ScoringSection (Enum) | "TEACHING" / "RESEARCH" / "SERVICE" |
| name | String | Category name |
| description | Text | Detailed description (nullable) |
| input_type | String | "number" / "percentage" / "currency_slab" / "text" |
| input_config | JSON | Sub-fields, slab definitions, etc. (nullable) |
| is_active | Boolean | Default true |
| created_at | DateTime | |
| updated_at | DateTime | |

### ScoringRule
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| category_id | UUID | FK to ScoringCategory |
| designation | Designation (Enum) | Which designation this rule applies to |
| max_weightage | Decimal | Maximum score obtainable |
| formula | JSON | Calculation rules (slabs, multipliers, etc.) |
| created_at | DateTime | |
| updated_at | DateTime | |

### AuditLog
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK to User |
| action | AuditAction (Enum) | |
| entity_type | String | "Application", "User", etc. |
| entity_id | UUID | ID of affected entity (nullable) |
| details | JSON | Additional context (nullable) |
| ip_address | String | Nullable |
| created_at | DateTime | |

---

## Relationships

- `User` belongs to `Department`
- `Application` belongs to `User` (faculty)
- `Application` optionally has a `reviewer` (User)
- `CategoryEntry` belongs to `Application` and `ScoringCategory`
- `ProofDocument` belongs to `CategoryEntry`
- `Review` belongs to `Application` and `User`
- `ScoringRule` belongs to `ScoringCategory`
- `AuditLog` belongs to `User`

---

## Critical Rules

1. **Scores calculated on backend only** — frontend never sends final scores
2. **Calculation logic centralized** in a single service module
3. **Cascading deletes** only on `CategoryEntry → ProofDocument`
4. **Soft deletes** on Users (is_active flag, never hard delete)
5. **All uploads validated** — PDF only, size limit enforced
6. **Passwords hashed** with bcrypt — never stored in plain text
7. **All routes protected** with JWT middleware
8. **All payloads validated** with Zod schemas
9. **Consistent API response format**: `{ success: boolean, data?: T, error?: string, message?: string }`
10. **Temporal Data & Retrospective Fallback**: The timestamps for freezing and routing (`frozen_at`, `sent_to_accounts_at`) are stored in `Application.frozen_at` (for new freeze events) but resolved dynamically from the `AuditLog` table using action types `APPLICATION_FROZEN` and `SENT_TO_ACCOUNTS` respectively. This avoids schema migrations and ensures full compatibility with historically processed applications.

