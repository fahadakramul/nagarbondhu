-- CreateTable
CREATE TABLE "submission_receipts" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "capability_hash" TEXT NOT NULL,
    "location_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "location_source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizen_feedback" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "review_status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citizen_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_notices" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_receipts_report_id_idx" ON "submission_receipts"("report_id");

-- CreateIndex
CREATE INDEX "citizen_feedback_review_status_created_at_idx" ON "citizen_feedback"("review_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "citizen_feedback_report_id_receipt_id_key" ON "citizen_feedback"("report_id", "receipt_id");

-- CreateIndex
CREATE INDEX "report_notices_report_id_created_at_idx" ON "report_notices"("report_id", "created_at");

-- AddForeignKey
ALTER TABLE "submission_receipts" ADD CONSTRAINT "submission_receipts_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_feedback" ADD CONSTRAINT "citizen_feedback_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_feedback" ADD CONSTRAINT "citizen_feedback_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "submission_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_notices" ADD CONSTRAINT "report_notices_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

