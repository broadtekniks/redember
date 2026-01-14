-- Ensure group-scoped variant types do not collide across groups.
-- Encode group id into the scope string for group-scoped types.

UPDATE "ProductVariantType"
SET "scope" = 'group:' || "groupId"
WHERE "groupId" IS NOT NULL
  AND "scope" = 'group';
