-- Migration 006: LTI Integration + Module Rename

-- Rename existing module IDs in session data
UPDATE simulation_sessions SET module_id = 'module4' WHERE module_id = 'module1';
UPDATE simulation_sessions SET module_id = 'module5' WHERE module_id = 'module2';

UPDATE module_masteries SET module_id = 'module4' WHERE module_id = 'module1';
UPDATE module_masteries SET module_id = 'module5' WHERE module_id = 'module2';

-- Persona assignments for LMS-launched users
CREATE TABLE IF NOT EXISTS persona_assignments (
  id SERIAL PRIMARY KEY,
  external_user_id VARCHAR(255) NOT NULL UNIQUE,
  persona_id VARCHAR(100) NOT NULL,
  assigned_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_persona_assignments_updated_at
  BEFORE UPDATE ON persona_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
