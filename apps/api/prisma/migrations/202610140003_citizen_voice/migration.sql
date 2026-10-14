ALTER TABLE "reports" ADD COLUMN "affirmations" JSONB, ADD COLUMN "citizen_verification" JSONB, ADD COLUMN "reopened_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "submission_receipts" ADD COLUMN "device_hash" TEXT;
