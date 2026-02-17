-- Seed Reaction Test game (idempotent)
INSERT INTO games (title, description, game_type)
SELECT
  'Reaction Test',
  'Measure your reaction time. Wait for the button, then click as fast as you can.',
  'reaction_test'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE game_type = 'reaction_test');
