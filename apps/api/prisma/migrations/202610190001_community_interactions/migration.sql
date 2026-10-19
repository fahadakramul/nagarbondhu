CREATE TABLE "community_likes" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "device_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_likes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_likes_post_id_device_hash_key" ON "community_likes"("post_id", "device_hash");
CREATE INDEX "community_likes_post_id_idx" ON "community_likes"("post_id");

CREATE TABLE "community_comments" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "device_hash" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_comments_post_id_created_at_idx" ON "community_comments"("post_id", "created_at");
