-- ArmPal Arena — per-user persistent settings (loaded before entering match)
CREATE TABLE IF NOT EXISTS public.arena_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  look_sensitivity_x numeric NOT NULL DEFAULT 0.002,
  look_sensitivity_y numeric NOT NULL DEFAULT 0.002,
  invert_y_axis boolean NOT NULL DEFAULT false,
  fov numeric NOT NULL DEFAULT 85,
  controller_sensitivity numeric NOT NULL DEFAULT 1,
  mouse_sensitivity numeric NOT NULL DEFAULT 1,
  touch_sensitivity numeric NOT NULL DEFAULT 1,
  movement_smoothing numeric NOT NULL DEFAULT 0.2,
  character_model text NOT NULL DEFAULT 'capsule',
  weapon_choice text NOT NULL DEFAULT 'pistol',
  crosshair_style text NOT NULL DEFAULT 'cross',
  ads_sensitivity numeric NOT NULL DEFAULT 0.5,
  controller_deadzone numeric NOT NULL DEFAULT 0.15,
  sprint_toggle boolean NOT NULL DEFAULT false,
  control_device text NOT NULL DEFAULT 'auto',
  jump_button_position text NOT NULL DEFAULT 'right',
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_settings_select_own" ON public.arena_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "arena_settings_insert_own" ON public.arena_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "arena_settings_update_own" ON public.arena_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE public.arena_settings IS 'Arena shooter per-user settings; loaded when arena loads, saved from Settings panel.';
