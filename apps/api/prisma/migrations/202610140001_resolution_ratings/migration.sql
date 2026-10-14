CREATE TABLE "resolution_ratings" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "voter_hash" TEXT NOT NULL,
    "after_photo_url" TEXT NOT NULL,
    "score" INTEGER NOT NULL CHECK ("score" BETWEEN 1 AND 5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resolution_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "resolution_ratings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "resolution_ratings_report_id_voter_hash_key" ON "resolution_ratings"("report_id", "voter_hash");
CREATE INDEX "resolution_ratings_report_id_after_photo_url_idx" ON "resolution_ratings"("report_id", "after_photo_url");
