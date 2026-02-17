INSERT INTO games (title, description, game_type, mode)
SELECT
  'Flappy Arm',
  'Tap to fly. Avoid the barbells!',
  'flappy_arm',
  'single'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE game_type = 'flappy_arm');
