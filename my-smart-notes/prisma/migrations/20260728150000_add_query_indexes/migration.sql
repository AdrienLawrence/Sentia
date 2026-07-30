CREATE INDEX "notebooks_user_id_created_at_idx"
ON "notebooks" ("user_id", "created_at");

CREATE INDEX "notebooks_user_id_last_opened_at_idx"
ON "notebooks" ("user_id", "last_opened_at");

CREATE INDEX "pages_notebook_id_user_id_page_number_idx"
ON "pages" ("notebook_id", "user_id", "page_number");

CREATE INDEX "pages_notebook_id_user_id_updated_at_idx"
ON "pages" ("notebook_id", "user_id", "updated_at");

CREATE INDEX "DrawBox_page_id_idx"
ON "DrawBox" ("page_id");

CREATE INDEX "DrawElement_draw_box_id_idx"
ON "DrawElement" ("draw_box_id");
