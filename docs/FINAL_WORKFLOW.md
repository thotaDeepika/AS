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
| 6 | `PRINCIPAL_REVIEWED` | Principal | Principal has reviewed (APPROVED or REJECTED) |
| 7 | `FROZEN` | Principal/Admin | Approved application is frozen (immutable) |
| 8 | `SENT_TO_ACCOUNTS` | Admin | Frozen application sent to accounts for processing |
| 9 | `REVERTED` | HOD/Admin | Reverted back to Faculty for editing and resubmitting |

## Review Decision (Enum — stored per review action)

```
RECOMMENDED | NOT_RECOMMENDED | APPROVED | REJECTED | REVERTED
```

- HOD uses: `RECOMMENDED` / `NOT_RECOMMENDED` / `REVERTED`
- Reviewer uses: `RECOMMENDED` / `NOT_RECOMMENDED`
- Principal uses: `APPROVED` / `REJECTED`
- Admin uses: `REVERTED` (through Admin override options)

---

## Detailed Workflow

### Step 1: Faculty Submission
```
DRAFT / REVERTED → SUBMITTED
```
- Faculty creates or edits an application, fills all 23 scoring categories
- Uploads PDF proofs per category
- Scores auto-calculated on backend upon submission
- **After submission: Faculty CANNOT edit the application** unless it is explicitly reverted back to them.

### Step 2: HOD Review
```
SUBMITTED → HOD_REVIEWED or REVERTED
```
- HOD sees all submitted applications from their department
- Verifies uploaded proofs against claimed values
- Adds comments
- Marks as `RECOMMENDED` or `NOT_RECOMMENDED` (application moves to Admin's queue) OR `REVERTED` (application goes back to `REVERTED` status for Faculty to edit and resubmit).

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
REVIEWER_REVIEWED → PRINCIPAL_REVIEWED (APPROVED / REJECTED) → FROZEN (if approved)
```
- Principal reviews the full application trail (faculty data, HOD comments, reviewer comments)
- Adds final comments
- Sets final decision: `APPROVED` or `REJECTED`
- If approved -> application is subsequently frozen via Admin override or automatically (`FROZEN` - immutable, cannot be reopened).
- If rejected -> Principal's decision is recorded, and the application remains in `PRINCIPAL_REVIEWED` status but flagged as rejected (Admin can later allow edits or override if needed).

### Step 7: Accounts Processing
```
FROZEN → SENT_TO_ACCOUNTS
```
- Admin consolidates all frozen+approved applications
- Sends consolidated list to Accounts department
- Accounts views and downloads reports for salary processing

---

## Workflow Rules & Confidentiality Masking

1. **Faculty Privacy & Review Masking:** To maintain confidentiality of the review process, Faculty members *never* see detailed review statuses like `PRINCIPAL_REVIEWED` (Approved or Rejected), `HOD_REVIEWED`, `REVIEWER_ASSIGNED`, `REVIEWER_REVIEWED`, or comments/signatures/scoring overrides from HOD, Reviewers, or Principal. In their portal and in the PDF reports generated for them, the application is presented only in a simplified state flow (`DRAFT`, `SUBMITTED`, or `REVERTED`).
2. Score calculation is **always automatic** on the backend.
3. Scores are **never editable** by any role.
4. File uploads are **PDF only**.
5. Faculty **cannot edit** after submission unless the application is in `REVERTED` or `DRAFT` status.
6. Every state transition creates an **audit log entry**.
7. Every comment is **timestamped and attributed** to the user who wrote it.

---

## Workflow Diagram

```
                                                        (Reviewer)
```
