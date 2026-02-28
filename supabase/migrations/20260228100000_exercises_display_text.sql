-- ================================================================
-- Universal format preservation: canonical display_text for exercises
-- (This codebase uses table "exercises"; task referred to workout_exercises.)
-- ================================================================

-- Canonical display field: exact text to show for each exercise
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS display_text TEXT;

-- Ordering index for workout exercise lists
CREATE INDEX IF NOT EXISTS workout_exercises_order_idx
  ON exercises (workout_id, position);

-- Backfill existing data (safe fallback from structured fields)
UPDATE exercises
SET display_text = COALESCE(
  NULLIF(TRIM(display_text), ''),
  TRIM(
    CONCAT(
      COALESCE(name, ''),
      CASE WHEN sets IS NOT NULL AND reps IS NOT NULL
        THEN CONCAT(' — ', sets, 'x', reps)
        ELSE ''
      END,
      CASE WHEN weight IS NOT NULL AND weight <> '' AND weight NOT LIKE '{%'
        THEN CONCAT(' — ', weight)
        ELSE ''
      END
    )
  )
)
WHERE display_text IS NULL OR TRIM(display_text) = '';

-- (Rows with JSON in weight keep display_text from first backfill; UI fallback handles display.)
