CREATE TABLE "deleted_account_tombstones" (
    "account_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deleted_account_tombstones_pkey" PRIMARY KEY ("account_hash")
);

CREATE INDEX "deleted_account_tombstones_expires_at_idx"
ON "deleted_account_tombstones"("expires_at");
