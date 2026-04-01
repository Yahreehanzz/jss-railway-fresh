-- Add missing columns to teachers table if they don't exist

ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;

ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Remove UNIQUE constraint from email if it exists (to allow multiple teachers without email)
ALTER TABLE teachers
DROP CONSTRAINT IF EXISTS teachers_email_key;

-- If dropping the constraint doesn't work, you can comment it out and run this instead:
-- ALTER TABLE teachers ALTER COLUMN email DROP NOT NULL;

-- Verify the table structure
-- \d teachers;
