CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE "page_chunks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "notebook_id" UUID NOT NULL,
  "page_id" UUID NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "embedding" extensions.vector(1536) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "page_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "page_chunks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "page_chunks_notebook_id_fkey"
    FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "page_chunks_page_id_fkey"
    FOREIGN KEY ("page_id") REFERENCES "pages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "page_chunks" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "page_chunks_page_id_chunk_index_key"
  ON "page_chunks"("page_id", "chunk_index");
CREATE INDEX "page_chunks_user_id_notebook_id_idx"
  ON "page_chunks"("user_id", "notebook_id");
CREATE INDEX "page_chunks_page_id_idx"
  ON "page_chunks"("page_id");

CREATE INDEX "page_chunks_embedding_hnsw_idx"
  ON "page_chunks"
  USING hnsw ("embedding" extensions.vector_cosine_ops);
