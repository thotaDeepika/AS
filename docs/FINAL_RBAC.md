# Role-Based Access Control (RBAC) — Final

## Role Enum

```
FACULTY | HOD | REVIEWER | PRINCIPAL | ADMIN | ACCOUNTS
```

---

## Faculty

### Permissions
- Create new appraisal application (one per cycle)
- Edit applications in `DRAFT` or `REVERTED` states
- Upload PDF proofs per scoring category
- Submit application (triggers score calculation on backend)
- View own application status (simplified/masked: `DRAFT`, `SUBMITTED`, or `REVERTED`)
- Download own submitted PDF report (excluding internal comments, scoring overrides, and signatures of HOD, Reviewer, or Principal)

### Restrictions
- Cannot edit application once submitted unless reverted by HOD or Admin
- Cannot modify automatically calculated scores
- Cannot see internal review comments, signature paths, or intermediate statuses (HOD, Reviewer, Principal)
- Cannot access other faculty's applications

---

## HOD (Head of Department)

### Permissions
- View all applications from own department only
- Review submitted applications
- View/download uploaded PDF proofs
- Add review comments and digital signature
- Mark application as `RECOMMENDED` or `NOT RECOMMENDED`
- Revert application back to the Faculty (`REVERTED` status) for revision/editing

### Restrictions
- Cannot modify any faculty data or form entries directly
- Cannot modify calculated scores (can only add comments and recommendation decisions)
- Cannot approve final applications (only recommends or rejects/reverts)
- Cannot view applications outside own department

---

## Reviewer

### Permissions
- View only applications assigned by Admin
- Verify application content and proofs
- Optionally override scores on specific categories (stored in `reviewer_score` fields)
- Add review comments and digital signature
- Mark application as `RECOMMENDED` or `NOT RECOMMENDED`

### Restrictions
- Cannot edit faculty application data directly (only through scoring overrides)
- Cannot assign other reviewers
- Cannot access unassigned applications

---

## Principal

### Permissions
- View applications that have passed HOD + Reviewer stages
- Add final comments and signature
- Set final decision: `APPROVED` or `REJECTED`
- Freeze approved applications (makes them immutable)

### Restrictions
- Cannot modify application data directly
- Cannot modify calculated scores
- Cannot reopen frozen applications (currently)

---

## Admin (Super User)

### Permissions
- Manage users (create, edit, disable accounts)
- Manage departments (create, edit)
- Configure scoring categories and weightages dynamically
- View all applications across all departments
- Assign reviewers to specific applications
- Track workflow progress across all stages
- Forward applications between workflow stages
- Manually freeze/unfreeze or allow edit/revert on any application
- Generate consolidated reports
- Send approved frozen list to Accounts

### Restrictions
- Cannot edit any faculty's appraisal form content directly
- Cannot modify automatically calculated scores

---

## Accounts Department

### Permissions
- View only frozen, approved applications sent by Admin
- Download consolidated reports (PDF and Excel)
- Export data for salary processing

### Restrictions
- Cannot modify any workflow state
- Cannot edit any applications
- Read-only access to final approved data

---

## Privacy & Report Visibility Matrix

| Content | FACULTY | HOD | REVIEWER | PRINCIPAL | ADMIN | ACCOUNTS |
|---------|---------|-----|----------|-----------|-------|----------|
| **Faculty Form Content** | View/Edit | View | View | View | View | View |
| **PDF Proofs** | View/Upload | View | View | View | View | View |
| **HOD Comments / Signature** | Masked | View/Write | View | View | View | View |
| **Reviewer Comments / Override** | Masked | Masked | View/Write | View | View | View |
| **Principal Comments / Decision** | Masked | View | View | View/Write | View | View |
| **Detailed Workflow Status** | Masked (simplified) | Full View | Full View | Full View | Full View | Full View |
| **PDF Report Format** | Masked Report | Full Report | Full Report | Full Report | Full Report | Full Report |

