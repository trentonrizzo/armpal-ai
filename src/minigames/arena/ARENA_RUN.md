# ArmPal Arena — Run checklist

1. **Install dependencies**
   ```bash
   npm install
   ```
   (Adds `@babylonjs/core` and `nipplejs` if not already in `package.json`.)

2. **Apply Supabase migrations**
   - If using Supabase CLI: `npx supabase db push` (or run the SQL in order in the SQL editor).
   - Required: `supabase/migrations/20250227000000_arena_tables.sql` (arena tables).
   - Required: `supabase/migrations/20250227100000_arena_join_code.sql` (adds 4-digit `join_code` to arena_matches).
   - Ensures `arena_matches`, `arena_match_players`, `arena_player_stats`, and `arena_leaderboard` view exist; `arena_matches` has `join_code` (unique among waiting/active matches).

3. **Enable Realtime for arena (optional)**
   - In Supabase Dashboard: Database → Replication → add `arena_matches` to the publication if you want status sync via Postgres changes. The game uses Realtime broadcast (channel `arena:<match_id>`) which does not require this.

4. **Start the app**
   ```bash
   npm run dev
   ```

5. **Open Arena**
   - Go to **Games** (e.g. `/games`) and open **ArmPal Arena** in the Arena section, or go directly to `/minigames/arena`.
   - Sign in if required. Create a match, **share the 4-digit code** (e.g. 4827), have a second player enter that code and join, then host clicks **Start Match**. Both clients enter the game; use left joystick to move, right half of screen to look, **FIRE** to shoot.

6. **Quick test**
   - Create match → note the 4-digit code → open another tab (or device) and join with that code → host starts → play one round (first to 7 kills or 90s). After match end, check Arena Leaderboard on the same page.
