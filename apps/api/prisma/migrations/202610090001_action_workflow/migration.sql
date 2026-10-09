-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'ADMIN', 'URBAN_PLANNER');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('ROAD_DAMAGE', 'WATERLOGGING', 'DRAINAGE', 'WASTE', 'FOOTPATH', 'STREETLIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'AI_ANALYZED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_FIELD_VERIFICATION', 'READY_FOR_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "ward_number" INTEGER NOT NULL,
    "ward_name" TEXT NOT NULL,
    "area_description" TEXT,
    "center_latitude" DOUBLE PRECISION NOT NULL,
    "center_longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "user_category" "ReportCategory",
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address_label" TEXT,
    "ward_id" TEXT,
    "image_url" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "action_status" "ActionStatus",
    "source_type" TEXT NOT NULL DEFAULT 'citizen_report',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "suggested_category" "ReportCategory" NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasons" JSONB NOT NULL,
    "missing_information" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "priority_assessments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "severity_factor" INTEGER NOT NULL,
    "impact_factor" INTEGER NOT NULL,
    "recurrence_factor" INTEGER NOT NULL,
    "age_factor" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "priority_level" "PriorityLevel" NOT NULL,
    "explanation" JSONB NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overridden_by" TEXT,
    "override_reason" TEXT,

    CONSTRAINT "priority_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "possible_duplicates" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "candidate_report_id" TEXT NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "matching_reasons" JSONB NOT NULL,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "possible_duplicates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_status_history" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "previous_status" "ReportStatus" NOT NULL,
    "new_status" "ReportStatus" NOT NULL,
    "changed_by" TEXT,
    "changed_by_label" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsible_persons" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ward_id" TEXT,
    "department_id" TEXT NOT NULL,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL,

    CONSTRAINT "responsible_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_recommendations" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "is_fallback" BOOLEAN NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_plans" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "recommendation_id" TEXT,
    "action_description" TEXT NOT NULL,
    "ward_id" TEXT NOT NULL,
    "officer_id" TEXT,
    "department_id" TEXT NOT NULL,
    "assignment_note" TEXT NOT NULL,
    "ward_verification_note" TEXT NOT NULL,
    "location_override_reason" TEXT,
    "priority" "PriorityLevel" NOT NULL,
    "urgency" TEXT NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,
    "admin_notes" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "resolution_notes" TEXT,
    "verification_method" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "verification_note" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "before_photo_url" TEXT,
    "after_photo_url" TEXT,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_images" (
    "id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_progress" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "photo_url" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_audit_events" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "wards_ward_number_key" ON "wards"("ward_number");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_category_idx" ON "reports"("category");

-- CreateIndex
CREATE INDEX "reports_latitude_longitude_idx" ON "reports"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at");

-- CreateIndex
CREATE INDEX "reports_ward_id_idx" ON "reports"("ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_report_id_key" ON "ai_analyses"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "priority_assessments_report_id_key" ON "priority_assessments"("report_id");

-- CreateIndex
CREATE INDEX "priority_assessments_priority_level_idx" ON "priority_assessments"("priority_level");

-- CreateIndex
CREATE INDEX "priority_assessments_score_idx" ON "priority_assessments"("score");

-- CreateIndex
CREATE INDEX "possible_duplicates_report_id_idx" ON "possible_duplicates"("report_id");

-- CreateIndex
CREATE INDEX "possible_duplicates_candidate_report_id_idx" ON "possible_duplicates"("candidate_report_id");

-- CreateIndex
CREATE INDEX "possible_duplicates_review_status_idx" ON "possible_duplicates"("review_status");

-- CreateIndex
CREATE INDEX "report_status_history_report_id_idx" ON "report_status_history"("report_id");

-- CreateIndex
CREATE INDEX "responsible_persons_ward_id_active_idx" ON "responsible_persons"("ward_id", "active");

-- CreateIndex
CREATE INDEX "action_recommendations_report_id_created_at_idx" ON "action_recommendations"("report_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "action_plans_report_id_key" ON "action_plans"("report_id");

-- CreateIndex
CREATE INDEX "action_plans_status_target_date_idx" ON "action_plans"("status", "target_date");

-- CreateIndex
CREATE INDEX "action_plans_ward_id_department_id_officer_id_idx" ON "action_plans"("ward_id", "department_id", "officer_id");

-- CreateIndex
CREATE INDEX "action_audit_events_report_id_created_at_idx" ON "action_audit_events"("report_id", "created_at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_assessments" ADD CONSTRAINT "priority_assessments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "possible_duplicates" ADD CONSTRAINT "possible_duplicates_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "possible_duplicates" ADD CONSTRAINT "possible_duplicates_candidate_report_id_fkey" FOREIGN KEY ("candidate_report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_persons" ADD CONSTRAINT "responsible_persons_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_persons" ADD CONSTRAINT "responsible_persons_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_recommendations" ADD CONSTRAINT "action_recommendations_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "action_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "responsible_persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_progress" ADD CONSTRAINT "action_progress_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "action_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_audit_events" ADD CONSTRAINT "action_audit_events_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_audit_events" ADD CONSTRAINT "action_audit_events_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "action_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_audit_events" ADD CONSTRAINT "action_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

