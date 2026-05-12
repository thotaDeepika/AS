# Faculty Appraisal & Increment Management System

## Overview

This is an intranet-based Faculty Appraisal and Increment Management System for **Ramaiah Institute of Technology, Bangalore - 560054** (Autonomous Institute, affiliated to VTU).

The system digitizes the traditional paper-based annual appraisal process by providing a centralized workflow platform with role-based access control, automatic score calculations, approval lifecycle tracking, document uploads, and reporting features.

The system is intended for deployment **inside the college intranet only** and will not be publicly accessible.

---

## Objectives

- Eliminate paper-based appraisal workflows
- Automate score calculations based on the institute's prescribed rubric
- Maintain transparent multi-tier approval workflows
- Enable document verification through uploaded PDF proofs
- Generate consolidated reports for accounts and administration
- Maintain audit logs and workflow history
- Improve operational efficiency for appraisal processing

---

## User Roles

| # | Role | Description |
|---|------|-------------|
| 1 | Faculty | Fills and submits the annual appraisal form |
| 2 | HOD | Reviews department faculty submissions |
| 3 | Admin | Super user who orchestrates the entire workflow |
| 4 | Reviewer | Cross-verifies applications assigned by Admin |
| 5 | Principal | Final authority — approves/rejects and freezes |
| 6 | Accounts Dept | Receives consolidated approved list for processing |

---

## Core Workflow

```
Faculty Submission → HOD Review → Admin Routes → Reviewer Verification → Admin Routes → Principal Approval → Freeze → Accounts Processing
```

---

## Core Features

- Role-Based Access Control (RBAC)
- Faculty appraisal submission with 23 scoring categories
- Automatic score calculation (designation-aware: Asst. Prof / Assoc. Prof / Professor)
- PDF proof uploads per scoring category
- HOD review and recommendation workflow
- Admin orchestration (reviewer assignment, workflow tracking)
- Reviewer verification workflow
- Principal approval and freeze workflow
- Accounts department consolidated reporting
- Advanced search and filtering (by department, designation, status, month)
- PDF export of appraisal forms and consolidated reports
- Comprehensive audit logging
- Dynamic scoring configuration by Admin

---

## Deployment Model

- Internal college intranet only
- Desktop-first application (no mobile responsiveness needed)
- No external internet access required
- Must be easily deployable on college infrastructure
- Must also be runnable locally for development and testing

---

## Capacity

- Minimum 300 faculty users
- ~10-15 departments
- Annual appraisal cycle (monthly batches based on joining month)

---

## Constraints

- No reverse workflow (rejected applications stay rejected for now)
- Resubmission support to be configurable for future enablement
- No one can manually edit calculated scores
- Appraisal cycle format is consistent across all departments
- File uploads restricted to PDF only with configurable size limits
