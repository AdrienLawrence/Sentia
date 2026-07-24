-- ScribeAI accesses application tables through its server routes, not directly
-- from the browser. Keep the exposed Supabase Data API roles out of these tables.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notebooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DrawBox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DrawElement" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "users" FROM anon, authenticated;
REVOKE ALL ON TABLE "notebooks" FROM anon, authenticated;
REVOKE ALL ON TABLE "pages" FROM anon, authenticated;
REVOKE ALL ON TABLE "feedback" FROM anon, authenticated;
REVOKE ALL ON TABLE "DrawBox" FROM anon, authenticated;
REVOKE ALL ON TABLE "DrawElement" FROM anon, authenticated;

CREATE TABLE "api_rate_limits" (
  "key" VARCHAR(200) NOT NULL,
  "window_started_at" TIMESTAMPTZ(6) NOT NULL,
  "count" INTEGER NOT NULL,
  CONSTRAINT "api_rate_limits_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "api_rate_limits_count_check" CHECK ("count" > 0)
);

ALTER TABLE "api_rate_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "api_rate_limits" FROM anon, authenticated;

ALTER TABLE "notebooks"
  ADD CONSTRAINT "notebooks_style_check"
  CHECK ("style" IN ('blank', 'standard', 'composition', 'grid'));

ALTER TABLE "pages"
  ADD CONSTRAINT "pages_page_number_check"
  CHECK ("page_number" > 0);

ALTER TABLE "DrawBox"
  ADD CONSTRAINT "DrawBox_dimensions_check"
  CHECK ("width" BETWEEN 1 AND 10000 AND "height" BETWEEN 1 AND 10000);

ALTER TABLE "DrawElement"
  ADD CONSTRAINT "DrawElement_type_check"
  CHECK ("type" IN ('rectangle', 'circle', 'arrow', 'line', 'text')),
  ADD CONSTRAINT "DrawElement_dimensions_check"
  CHECK ("width" BETWEEN 1 AND 10000 AND "height" BETWEEN 1 AND 10000);

ALTER TABLE "feedback"
  ADD CONSTRAINT "feedback_message_length_check"
  CHECK (char_length("message") BETWEEN 10 AND 2000);
