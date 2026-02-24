-- Daily Nutrition Tracker: entries per user per date
-- Future-ready for AI coach: weekly calories, protein averages, streak tracking

CREATE TABLE IF NOT EXISTS public.nutrition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  food_name text,
  calories integer NOT NULL DEFAULT 0,
  protein integer NOT NULL DEFAULT 0,
  carbs integer NOT NULL DEFAULT 0,
  fat integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON public.nutrition_entries(user_id, date);

ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_entries_select_own"
  ON public.nutrition_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "nutrition_entries_insert_own"
  ON public.nutrition_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_entries_update_own"
  ON public.nutrition_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_entries_delete_own"
  ON public.nutrition_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.nutrition_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nutrition_entries_updated_at ON public.nutrition_entries;
CREATE TRIGGER nutrition_entries_updated_at
  BEFORE UPDATE ON public.nutrition_entries
  FOR EACH ROW EXECUTE PROCEDURE public.nutrition_entries_updated_at();

COMMENT ON TABLE public.nutrition_entries IS 'Daily nutrition log; structured for AI coach (weekly averages, streaks).';
