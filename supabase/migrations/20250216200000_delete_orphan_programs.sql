-- Remove programs that have no program_logic row (broken duplicates)
DELETE FROM programs
WHERE id NOT IN (
  SELECT program_id FROM program_logic
);
