CREATE TABLE "mcp_idempotency_records" (
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "request_id" UUID NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_idempotency_records_pkey"
        PRIMARY KEY ("user_id", "operation", "request_id"),
    CONSTRAINT "mcp_idempotency_records_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mcp_idempotency_records_created_at_idx"
    ON "mcp_idempotency_records"("created_at");
