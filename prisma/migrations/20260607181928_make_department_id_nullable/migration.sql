-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FACULTY', 'HOD', 'REVIEWER', 'PRINCIPAL', 'ADMIN', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('ASSISTANT_PROFESSOR', 'ASSOCIATE_PROFESSOR', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'REVERTED', 'SUBMITTED', 'HOD_REVIEWED', 'REVIEWER_ASSIGNED', 'REVIEWER_REVIEWED', 'PRINCIPAL_REVIEWED', 'FROZEN', 'SENT_TO_ACCOUNTS');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('RECOMMENDED', 'NOT_RECOMMENDED', 'APPROVED', 'REJECTED', 'REVERTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'APPLICATION_CREATED', 'APPLICATION_SUBMITTED', 'APPLICATION_REVIEWED', 'REVIEWER_ASSIGNED', 'APPLICATION_FROZEN', 'SENT_TO_ACCOUNTS', 'FILE_UPLOADED', 'COMMENT_ADDED', 'USER_CREATED', 'USER_UPDATED', 'SCORING_CONFIG_UPDATED', 'APPLICATION_HOD_REVIEWED', 'APPLICATION_REVIEWER_REVIEWED', 'APPLICATION_PRINCIPAL_REVIEWED', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "ScoringSection" AS ENUM ('TEACHING', 'RESEARCH', 'SERVICE');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FACULTY',
    "designation" "Designation",
    "department_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joining_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "total_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "bonus_score" DECIMAL(6,2),
    "reviewer_score" DECIMAL(6,2),
    "final_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "frozen_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_categories" (
    "id" TEXT NOT NULL,
    "sl_no" INTEGER NOT NULL,
    "section" "ScoringSection" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "input_type" TEXT NOT NULL,
    "input_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "designation" "Designation" NOT NULL,
    "max_weightage" DECIMAL(6,2) NOT NULL,
    "formula" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_entries" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "raw_value" JSONB NOT NULL,
    "calculated_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "reviewer_score" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_documents" (
    "id" TEXT NOT NULL,
    "category_entry_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
    "item_index" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "reviewer_user_id" TEXT NOT NULL,
    "role_at_review" "Role" NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comments" TEXT,
    "signature_path" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "applications_faculty_id_academic_year_key" ON "applications"("faculty_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_category_id_designation_key" ON "scoring_rules"("category_id", "designation");

-- CreateIndex
CREATE UNIQUE INDEX "category_entries_application_id_category_id_key" ON "category_entries"("application_id", "category_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_rules" ADD CONSTRAINT "scoring_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scoring_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_entries" ADD CONSTRAINT "category_entries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_entries" ADD CONSTRAINT "category_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "scoring_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_documents" ADD CONSTRAINT "proof_documents_category_entry_id_fkey" FOREIGN KEY ("category_entry_id") REFERENCES "category_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
