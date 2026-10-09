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
| 4 | `REVIEWER_ASSIGNED` | Admin | Admin assigns a peer reviewer from any department |
| 5 | `CHAIRMAN_ASSIGNED` | Reviewer (Auto) | Peer reviewer completes review; automatically forwarded to Chairman Reviewer |
| 6 | `CHAIRMAN_REVIEWED` | Chairman Reviewer | Chairman Reviewer has verified (recommended or not recommended) |
| 7 | `PRINCIPAL_REVIEWED` | Principal | Principal has reviewed (APPROVED or REJECTED) |
| 8 | `FROZEN` | Principal/Admin | Approved application is frozen (immutable) |
| 9 | `SENT_TO_ACCOUNTS` | Admin | Frozen application sent to accounts for processing |
| 10 | `REVERTED` | HOD/Admin | Reverted back to Faculty for editing and resubmitting |

## Review Decision (Enum — stored per review action)

```
RECOMMENDED | NOT_RECOMMENDED | APPROVED | REJECTED | REVERTED
```

- HOD uses: `RECOMMENDED` / `NOT_RECOMMENDED` / `REVERTED`
- Reviewer uses: `RECOMMENDED` / `NOT_RECOMMENDED`
- Chairman Reviewer uses: `RECOMMENDED` / `NOT_RECOMMENDED`
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
- Marks as `RECOMMENDED` or `NOT_RECOMMENDED` (application moves to Admin's reviewer assignment queue) OR `REVERTED` (application goes back to `REVERTED` status for Faculty to edit and resubmit).

### Step 3: Admin Routes to Peer Reviewer
```
HOD_REVIEWED → REVIEWER_ASSIGNED
```
- Admin views all HOD-reviewed applications
- Assigns a peer reviewer (can be a faculty from any department)
- Application appears in assigned Reviewer's dashboard

### Step 4: Peer Reviewer Verification & Automated Forwarding
```
REVIEWER_ASSIGNED → CHAIRMAN_ASSIGNED (Automatic)
```
- Peer Reviewer verifies application content, scores, and proofs
- Can override entry scores or overall reviewer score
- Marks as `RECOMMENDED` or `NOT_RECOMMENDED`
- **Automated Forwarding:** Application is automatically forwarded to the Chairman Reviewer (`CHAIRMAN_ASSIGNED`), and the Chairman Reviewer is auto-assigned and notified via email. Admin intervention/forwarding is not required.

### Step 5: Chairman Reviewer Evaluation
```
CHAIRMAN_ASSIGNED → CHAIRMAN_REVIEWED
```
- Chairman Reviewer reviews peer reviewer's inputs, scores, and faculty proofs
- Adds apex committee remarks and sets decision (`RECOMMENDED` / `NOT_RECOMMENDED`)
- Application moves directly into Principal's review queue.

### Step 6: Principal Final Decision
```
CHAIRMAN_REVIEWED → PRINCIPAL_REVIEWED (APPROVED / REJECTED) → FROZEN (if approved)
```
- Principal reviews the full evaluation trail (faculty data, HOD comments, peer reviewer comments, chairman reviewer comments)
- Adds final remarks
- Sets final decision: `APPROVED` or `REJECTED`
- If approved -> application is subsequently frozen (`FROZEN` - immutable).
- If rejected -> Principal's decision is recorded, and the application remains in `PRINCIPAL_REVIEWED` status flagged as rejected.

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
