-- Fix Security Definer View Issues
-- Run this SQL in your Supabase SQL Editor to fix the security errors

-- Drop the existing views that have SECURITY DEFINER
DROP VIEW IF EXISTS daily_challenge_today;
DROP VIEW IF EXISTS top_scores;

-- Recreate daily_challenge_today view with SECURITY INVOKER (default)
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

-- Recreate top_scores view with SECURITY INVOKER (default)
CREATE OR REPLACE VIEW top_scores AS
SELECT 
    player_name,
    score,
    words_used,
    game_mode,
    game_duration_seconds,
    max_chain_multiplier,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY game_mode ORDER BY score DESC) as rank
FROM leaderboard
ORDER BY game_mode, score DESC;

-- Grant necessary permissions to the views
GRANT SELECT ON daily_challenge_today TO anon;
GRANT SELECT ON daily_challenge_today TO authenticated;
GRANT SELECT ON top_scores TO anon;
GRANT SELECT ON top_scores TO authenticated;

-- Add comments to document the views
COMMENT ON VIEW daily_challenge_today IS 'View for today''s daily challenge leaderboard (SECURITY INVOKER)';
COMMENT ON VIEW top_scores IS 'View for top scores by game mode (SECURITY INVOKER)'; 