-- Baseline for tables that existed before Prisma migration tracking.
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notebooks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "style" TEXT NOT NULL DEFAULT 'blank',
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_opened_at" TIMESTAMPTZ(6),
  CONSTRAINT "notebooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT,
  "page_number" INTEGER NOT NULL DEFAULT 1,
  "content" JSONB,
  "user_id" UUID NOT NULL,
  "notebook_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrawBox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "page_id" UUID NOT NULL,
  "x_position" INTEGER NOT NULL,
  "y_position" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrawBox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DrawElement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "draw_box_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "properties" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrawElement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "notebooks"
  ADD CONSTRAINT "notebooks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pages"
  ADD CONSTRAINT "pages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pages"
  ADD CONSTRAINT "pages_notebook_id_fkey"
  FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrawBox"
  ADD CONSTRAINT "DrawBox_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "pages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrawElement"
  ADD CONSTRAINT "DrawElement_draw_box_id_fkey"
  FOREIGN KEY ("draw_box_id") REFERENCES "DrawBox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- New feedback system.
CREATE TABLE "feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "category" VARCHAR(24) NOT NULL,
  "message" VARCHAR(2000) NOT NULL,
  "rating" INTEGER,
  "contact_allowed" BOOLEAN NOT NULL DEFAULT false,
  "context" JSONB,
  "status" VARCHAR(24) NOT NULL DEFAULT 'submitted',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_rating_check"
    CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5),
  CONSTRAINT "feedback_category_check"
    CHECK ("category" IN ('bug', 'idea', 'experience', 'other')),
  CONSTRAINT "feedback_status_check"
    CHECK ("status" IN ('submitted', 'reviewing', 'planned', 'resolved')),
  CONSTRAINT "feedback_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "feedback_user_id_created_at_idx"
  ON "feedback"("user_id", "created_at");

CREATE INDEX "feedback_status_created_at_idx"
  ON "feedback"("status", "created_at");
