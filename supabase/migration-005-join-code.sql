-- Add join_code to businesses for request access flow
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Generate codes for existing businesses (6 char alphanumeric)
UPDATE businesses
SET join_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
WHERE join_code IS NULL;

-- Make join_code required for future inserts
ALTER TABLE businesses
ALTER COLUMN join_code SET NOT NULL;
