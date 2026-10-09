-- CreateTable
CREATE TABLE "cluster_reviews" (
    "id" TEXT NOT NULL,
    "report_ids" JSONB NOT NULL,
    "state" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cluster_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_missions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "report_ids" JSONB NOT NULL,
    "department_id" TEXT,
    "officer_id" TEXT,
    "team" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "route" JSONB NOT NULL,
    "updates" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_missions_source_type_status_idx" ON "field_missions"("source_type", "status");

-- AddForeignKey
ALTER TABLE "cluster_reviews" ADD CONSTRAINT "cluster_reviews_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_missions" ADD CONSTRAINT "field_missions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

