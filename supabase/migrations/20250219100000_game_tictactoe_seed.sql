-- Seed Tic Tac Toe multiplayer game
INSERT INTO games (title, description, game_type, mode)
SELECT
  'Tic Tac Toe',
  'Classic 3x3. Play with a friend.',
  'tictactoe',
  'multiplayer'
WHERE NOT EXISTS (SELECT 1 FROM games WHERE game_type = 'tictactoe');
