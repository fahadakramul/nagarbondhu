CREATE TABLE "community_posts" (
  "id" TEXT NOT NULL,
  "device_hash" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "ward_number" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_posts_created_at_idx" ON "community_posts"("created_at");
CREATE INDEX "community_posts_topic_created_at_idx" ON "community_posts"("topic", "created_at");
ALTER TABLE "community_comments" ADD COLUMN "deleted_at" TIMESTAMP(3);
