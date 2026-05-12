# Role-Based Access Control (RBAC) — Final

## Role Enum

```
FACULTY | HOD | REVIEWER | PRINCIPAL | ADMIN | ACCOUNTS
```

---

## Faculty

### Permissions
- Create new appraisal application (one per cycle)
- Edit draft applications (before submission only)
- Upload PDF proofs per scoring category
- Submit application (triggers score calculation on backend)
- View own application status and history
- Download own submitted PDF report

### Restrictions
- Cannot edit application after submission
- Cannot modify calculated scores
- Cannot access other faculty's applications
- Cannot resubmit (future configurable)

---

## HOD (Head of Department)

### Permissions
- View all applications from own department only
- Review submitted applications
- View/download uploaded PDF proofs
- Add review comments
- Mark application as `RECOMMENDED` or `NOT RECOMMENDED`

### Restrictions
- Cannot modify any faculty data or form entries
- Cannot modify calculated scores
- Cannot approve final applications (only recommends)
- Cannot view applications outside own department

---

## Reviewer

### Permissions
- View only applications assigned by Admin
- Verify application content and proofs
- Add review comments
- Mark application as `RECOMMENDED` or `NOT RECOMMENDED`

### Restrictions
- Cannot edit faculty application data
- Cannot edit or override scores
- Cannot assign other reviewers
- Cannot access unassigned applications

---

## Principal

### Permissions
- View applications that have passed HOD + Reviewer stages
- Add final comments
- Set final status: `APPROVED` or `REJECTED`
- Freeze approved applications (makes them immutable)

### Restrictions
- Cannot modify application data
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
- Generate consolidated reports
- Send approved frozen list to Accounts

### Restrictions
- Cannot override approval decisions (HOD/Reviewer/Principal)
- Cannot edit any faculty's appraisal form content
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
