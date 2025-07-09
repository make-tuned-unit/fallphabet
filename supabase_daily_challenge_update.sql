-- Fallphabet Daily Challenge Update for Supabase
-- Run this SQL in your Supabase SQL Editor to add Daily Challenge support

-- Add new columns to the existing leaderboard table
ALTER TABLE leaderboard 
ADD COLUMN IF NOT EXISTS attempt_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS daily_seed INTEGER DEFAULT 0;

-- Create a unique constraint to ensure one attempt per day per player for Daily Challenge
-- This will prevent multiple submissions for the same player on the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_challenge_unique 
ON leaderboard (player_name, attempt_date) 
WHERE game_mode = 'daily_challenge';

-- Create an index for efficient daily challenge queries
CREATE INDEX IF NOT EXISTS idx_daily_challenge_date 
ON leaderboard (attempt_date, game_mode, score DESC);

-- Create a function to get the daily seed (for consistent daily challenges)
CREATE OR REPLACE FUNCTION get_daily_seed()
RETURNS INTEGER AS $$
BEGIN
  -- Use the current date as a seed for consistent daily challenges
  -- This ensures all players get the same tile sequence on the same day
  RETURN EXTRACT(EPOCH FROM CURRENT_DATE)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if player has already attempted today's daily challenge
CREATE OR REPLACE FUNCTION has_daily_attempt_today(player_name_param VARCHAR)
RETURNS JSON AS $$
DECLARE
  attempt_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM leaderboard 
    WHERE player_name = player_name_param 
    AND game_mode = 'daily_challenge' 
    AND attempt_date = CURRENT_DATE
  ) INTO attempt_exists;
  
  RETURN json_build_object('has_attempted', attempt_exists);
END;
$$ LANGUAGE plpgsql;

-- Create a function to get today's daily challenge leaderboard
CREATE OR REPLACE FUNCTION get_daily_challenge_leaderboard()
RETURNS TABLE (
  rank INTEGER,
  player_name VARCHAR,
  score INTEGER,
  words_used INTEGER,
  top_word VARCHAR,
  top_word_score INTEGER,
  max_chain_multiplier INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY l.score DESC, l.words_used ASC, l.created_at ASC) as rank,
    l.player_name,
    l.score,
    l.words_used,
    l.top_word,
    l.top_word_score,
    l.max_chain_multiplier,
    l.created_at
  FROM leaderboard l
  WHERE l.game_mode = 'daily_challenge' 
  AND l.attempt_date = CURRENT_DATE
  ORDER BY l.score DESC, l.words_used ASC, l.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to submit daily challenge score
CREATE OR REPLACE FUNCTION submit_daily_challenge_score(
  player_name_param VARCHAR,
  score_param INTEGER,
  words_used_param INTEGER,
  top_word_param VARCHAR,
  top_word_score_param INTEGER,
  max_chain_multiplier_param INTEGER
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  daily_seed_val INTEGER;
BEGIN
  -- Check if player has already attempted today
  IF has_daily_attempt_today(player_name_param) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You have already completed today''s daily challenge. Come back tomorrow!'
    );
  END IF;
  
  -- Get today's seed
  daily_seed_val := get_daily_seed();
  
  -- Insert the score
  INSERT INTO leaderboard (
    player_name, 
    score, 
    words_used, 
    top_word,
    top_word_score,
    game_mode, 
    max_chain_multiplier, 
    attempt_date,
    daily_seed
  ) VALUES (
    player_name_param, 
    score_param, 
    words_used_param, 
    top_word_param,
    top_word_score_param,
    'daily_challenge', 
    max_chain_multiplier_param, 
    CURRENT_DATE,
    daily_seed_val
  );
  
  -- Get the player's rank
  SELECT json_build_object(
    'success', true,
    'rank', (
      SELECT l.rank FROM get_daily_challenge_leaderboard() l
      WHERE l.player_name = player_name_param
    ),
    'total_participants', (
      SELECT COUNT(*) FROM leaderboard l
      WHERE l.game_mode = 'daily_challenge' 
      AND l.attempt_date = CURRENT_DATE
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to allow reading daily challenge leaderboards
DROP POLICY IF EXISTS "Allow reading daily challenge leaderboards" ON leaderboard;
CREATE POLICY "Allow reading daily challenge leaderboards" ON leaderboard
  FOR SELECT USING (true);

-- Update RLS policies to allow inserting daily challenge scores
DROP POLICY IF EXISTS "Allow inserting daily challenge scores" ON leaderboard;
CREATE POLICY "Allow inserting daily challenge scores" ON leaderboard
  FOR INSERT WITH CHECK (true);

-- Create a view for easier daily challenge queries
CREATE OR REPLACE VIEW daily_challenge_today AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY score DESC, words_used ASC, created_at ASC) as rank,
  player_name,
  score,
  words_used,
  top_word,
  top_word_score,
  max_chain_multiplier,
  created_at
FROM leaderboard
WHERE game_mode = 'daily_challenge' 
AND attempt_date = CURRENT_DATE
ORDER BY score DESC, words_used ASC, created_at ASC;

-- Grant necessary permissions
GRANT SELECT ON daily_challenge_today TO anon;
GRANT EXECUTE ON FUNCTION get_daily_challenge_leaderboard() TO anon;
GRANT EXECUTE ON FUNCTION submit_daily_challenge_score(VARCHAR, INTEGER, INTEGER, VARCHAR, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION has_daily_attempt_today(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_daily_seed() TO anon;

-- Add some helpful comments
COMMENT ON TABLE leaderboard IS 'Leaderboard for both Daily Challenge and Fallphabet Taptile modes';
COMMENT ON COLUMN leaderboard.attempt_date IS 'Date of the attempt (for daily challenge)';
COMMENT ON COLUMN leaderboard.daily_seed IS 'Seed used for daily challenge tile generation';
COMMENT ON FUNCTION get_daily_seed() IS 'Returns consistent seed for daily challenges';
COMMENT ON FUNCTION has_daily_attempt_today(VARCHAR) IS 'Checks if player has already attempted today''s daily challenge';
COMMENT ON FUNCTION submit_daily_challenge_score(VARCHAR, INTEGER, INTEGER, VARCHAR, INTEGER, INTEGER) IS 'Submits daily challenge score with one attempt per day limit'; 