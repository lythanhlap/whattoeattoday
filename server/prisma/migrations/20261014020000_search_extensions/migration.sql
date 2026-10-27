CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT unaccent('unaccent', $1) $$;

CREATE INDEX "recipes_search_fts_idx"
ON "recipes"
USING GIN (to_tsvector('simple', immutable_unaccent(coalesce("title", '') || ' ' || coalesce("description", ''))));

CREATE INDEX "recipes_title_trgm_idx"
ON "recipes"
USING GIN (immutable_unaccent("title") gin_trgm_ops);

CREATE INDEX "recipe_ingredients_name_trgm_idx"
ON "recipe_ingredients"
USING GIN (immutable_unaccent("displayName") gin_trgm_ops);
