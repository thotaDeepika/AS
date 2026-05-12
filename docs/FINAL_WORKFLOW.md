# Workflow Documentation — Final

## Application Lifecycle

The appraisal application follows a **strict forward-only sequential workflow**. No backward flow exists currently.

---

## Workflow States (Enum)

| # | State | Triggered By | Description |
|---|-------|-------------|-------------|
| 1 | `DRAFT` | Faculty | Application created, not yet submitted |
| 2 | `SUBMITTED` | Faculty | Faculty submits form; scores calculated on backend |
| 3 | `HOD_REVIEWED` | HOD | HOD has reviewed (recommended or not recommended) |
| 4 | `REVIEWER_ASSIGNED` | Admin | Admin assigns a reviewer from any department |
| 5 | `REVIEWER_REVIEWED` | Reviewer | Reviewer has verified (recommended or not recommended) |
| 6 | `PRINCIPAL_REVIEWED` | Principal | Principal approves or rejects |
| 7 | `FROZEN` | Principal/Admin | Approved application is frozen (immutable) |
| 8 | `SENT_TO_ACCOUNTS` | Admin | Frozen application sent to accounts for processing |

## Review Decision (Enum — stored per review action)

```
RECOMMENDED | NOT_RECOMMENDED | APPROVED | REJECTED
```

- HOD uses: `RECOMMENDED` / `NOT_RECOMMENDED`
- Reviewer uses: `RECOMMENDED` / `NOT_RECOMMENDED`
- Principal uses: `APPROVED` / `REJECTED`

---

## Detailed Workflow

### Step 1: Faculty Submission
```
DRAFT → SUBMITTED
```
- Faculty creates application, fills all 23 scoring categories
- Uploads PDF proofs per category
- Scores auto-calculated on backend upon submission
- **After submission: Faculty CANNOT edit the application**

### Step 2: HOD Review
```
SUBMITTED → HOD_REVIEWED
```
- HOD sees all submitted applications from their department
- Verifies uploaded proofs against claimed values
- Adds comments
- Marks as `RECOMMENDED` or `NOT_RECOMMENDED`
- Application moves to Admin's queue regardless of decision

### Step 3: Admin Routes to Reviewer
```
HOD_REVIEWED → REVIEWER_ASSIGNED
```
- Admin views all HOD-reviewed applications
- Assigns a reviewer (can be a faculty from any department)
- Application appears in assigned Reviewer's dashboard

### Step 4: Reviewer Verification
```
REVIEWER_ASSIGNED → REVIEWER_REVIEWED
```
- Reviewer verifies the application content and proofs
- Cross-checks HOD's recommendation
- Adds comments
- Marks as `RECOMMENDED` or `NOT_RECOMMENDED`
- Application returns to Admin's queue

### Step 5: Admin Routes to Principal
```
REVIEWER_REVIEWED → (Admin forwards) → PRINCIPAL_REVIEWED
```
- Admin forwards reviewer-verified applications to Principal
- No state change until Principal acts

### Step 6: Principal Final Decision
```
→ PRINCIPAL_REVIEWED → FROZEN
```
- Principal reviews the full application trail (faculty data, HOD comments, reviewer comments)
- Adds final comments
- Sets final decision: `APPROVED` or `REJECTED`
- If approved → application is `FROZEN` (immutable, cannot be reopened)

### Step 7: Accounts Processing
```
FROZEN → SENT_TO_ACCOUNTS
```
- Admin consolidates all frozen+approved applications
- Sends consolidated list to Accounts department
- Accounts views and downloads reports for salary processing

---

## Workflow Rules

1. Score calculation is **always automatic** on the backend
2. Scores are **never editable** by any role
3. File uploads are **PDF only**
4. Faculty **cannot edit** after submission
5. **No reverse workflow** — rejected applications stay rejected
6. Resubmission support should be **configurable for future** (feature flag)
7. Every state transition creates an **audit log entry**
8. Every comment is **timestamped and attributed** to the user who wrote it

---

## Workflow Diagram

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌────────────────────┐
│  DRAFT   │───▶│ SUBMITTED │───▶│ HOD_REVIEWED │───▶│ REVIEWER_ASSIGNED  │
└──────────┘    └───────────┘    └──────────────┘    └────────────────────┘
  (Faculty)      (Faculty)          (HOD)                  (Admin)
                                                              │
                                                              ▼
┌───────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│ SENT_TO_ACCOUNTS  │◀───│      FROZEN        │◀───│ PRINCIPAL_REVIEWED │
└───────────────────┘    └────────────────────┘    └────────────────────┘
      (Admin)             (Principal/Admin)          (Principal)
                                                              ▲
                                                              │
                                                   ┌────────────────────┐
                                                   │ REVIEWER_REVIEWED  │
                                                   └────────────────────┘
                                                        (Reviewer)
```
