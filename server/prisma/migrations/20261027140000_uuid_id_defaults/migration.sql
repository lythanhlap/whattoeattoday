-- Align the three tables created without an id default with the rest of the schema.
-- Prisma maps @default(uuid()) to an application-side default, so these tables never
-- received the database default that every other uuid table already had.
ALTER TABLE "challenges" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "challenge_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "recipe_views" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
