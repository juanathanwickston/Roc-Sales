-- ROC Academy: Add last_login tracking
-- Adds last_login column to users table for admin visibility.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
