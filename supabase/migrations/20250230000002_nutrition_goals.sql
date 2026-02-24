-- Nutrition goals per user (optional daily targets + show progress bars)
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calories_goal integer,
  protein_goal integer,
  carbs_goal integer,
  fat_goal integer,
  show_progress boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_goals_select_own"
  ON public.nutrition_goals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_insert_own"
  ON public.nutrition_goals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_update_own"
  ON public.nutrition_goals FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_delete_own"
  ON public.nutrition_goals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Optional: keep updated_at in sync
CREATE OR REPLACE FUNCTION public.nutrition_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nutrition_goals_updated_at ON public.nutrition_goals;
CREATE TRIGGER nutrition_goals_updated_at
  BEFORE UPDATE ON public.nutrition_goals
  FOR EACH ROW EXECUTE PROCEDURE public.nutrition_goals_updated_at();

COMMENT ON TABLE public.nutrition_goals IS 'Per-user daily nutrition targets and progress bar preference.';
