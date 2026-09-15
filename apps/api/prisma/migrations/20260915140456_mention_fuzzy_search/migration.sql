-- Tìm mờ @mention (docs/05-hien-thuc/phase-4.md): không dấu, gõ thiếu, sai một ký tự vẫn ra người.
-- unaccent() không IMMUTABLE nên bọc lại để dùng được trong index biểu thức.
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT lower(public.unaccent('public.unaccent', $1)) $$;

CREATE INDEX IF NOT EXISTS "users_full_name_trgm"  ON "users" USING gin (public.f_unaccent("full_name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_short_name_trgm" ON "users" USING gin (public.f_unaccent(coalesce("short_name", '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_email_trgm"      ON "users" USING gin (lower("email"::text) gin_trgm_ops);
