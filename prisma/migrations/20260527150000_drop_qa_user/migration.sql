-- Drop legacy QaUser table.
-- Confirmed zero usage in application code (no prisma.qaUser calls anywhere in src/).
-- Table is superseded by CreatedUser + UserProfile models.
-- Data loss is intentional and safe: this table was never used by the application.
DROP TABLE IF EXISTS "QaUser";
