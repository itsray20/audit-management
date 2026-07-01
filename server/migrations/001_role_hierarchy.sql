-- ---------------------------------------------------------------
-- MIGRATION 001: Role Hierarchy, Hospitals, Audit Members
-- Run this ONCE in your Supabase SQL Editor
-- ---------------------------------------------------------------

-- Step 1: Add new columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Step 2: Backfill display_name from existing name column (DisplayName|Password|Slot format)
UPDATE users
SET display_name = SPLIT_PART(name, '|', 1)
WHERE display_name IS NULL AND name IS NOT NULL AND name LIKE '%|%';

UPDATE users
SET display_name = name
WHERE display_name IS NULL AND name IS NOT NULL;

-- Step 3: Drop old role constraint and update Auditor role to CoFounder
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'CoFounder' WHERE role = 'Auditor';

-- Step 4: Create hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  contact_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 5: Seed initial hospitals
INSERT INTO hospitals (name, location, contact_number) VALUES
  ('Kukatpally', 'Kukatpally, Hyderabad', ''),
  ('Ameerpet', 'Ameerpet, Hyderabad', ''),
  ('Dilsukhnagar', 'Dilsukhnagar, Hyderabad', ''),
  ('Miyapur', 'Miyapur, Hyderabad', ''),
  ('KPHB', 'KPHB Colony, Hyderabad', '')
ON CONFLICT DO NOTHING;

-- Step 6: Add hospital_id and created_by to audit_sessions
ALTER TABLE audit_sessions
  ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id),
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Step 7: Create audit_members table
CREATE TABLE IF NOT EXISTS audit_members (
  id SERIAL PRIMARY KEY,
  audit_session_id INTEGER NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'active',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  frozen_at TIMESTAMP WITH TIME ZONE,
  removed_at TIMESTAMP WITH TIME ZONE,
  action_by TEXT,
  UNIQUE(audit_session_id, user_id)
);
