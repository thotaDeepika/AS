# Workflow Documentation

## Application Lifecycle

The appraisal application follows a strict sequential workflow.

---

# Workflow Stages

1. DRAFT
2. SUBMITTED
3. HOD_APPROVED
4. HOD_REJECTED
5. REVIEWER_ASSIGNED
6. REVIEWER_APPROVED
7. REVIEWER_REJECTED
8. PRINCIPAL_APPROVED
9. PRINCIPAL_REJECTED
10. FROZEN
11. SENT_TO_ACCOUNTS

---

# Workflow Description

## Faculty

- Creates appraisal application
- Fills all sections
- Uploads PDF proofs
- Views calculated scores
- Submits application

After submission:
- Faculty cannot edit application

---

## HOD

- Views department applications
- Verifies uploaded proofs
- Adds comments
- Recommends or rejects application

HOD cannot:
- Modify faculty data
- Modify scores

---

## Admin

- Views approved applications
- Assigns reviewers
- Tracks workflow progress
- Generates reports

Admin cannot:
- Modify appraisal content
- Override scores

---

## Reviewer

- Reviews assigned applications
- Verifies proofs and scores
- Adds comments
- Recommends or rejects

Reviewer cannot:
- Edit faculty application data
- Modify scores

---

## Principal

- Reviews final applications
- Approves or rejects
- Freezes approved applications

Frozen applications:
- Cannot be edited
- Cannot be reopened currently

---

## Accounts Department

- Views finalized approved applications
- Downloads consolidated reports
- Processes increment-related activities

---

# Workflow Rules

- Score calculation is automatic
- Scores are calculated only in backend
- PDF uploads only
- Faculty cannot edit after submission
- No reverse workflow currently
- Resubmission support should be configurable for future
