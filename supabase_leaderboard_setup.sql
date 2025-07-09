-- Fallphabet Leaderboard Setup for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Create the leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    words_used INTEGER NOT NULL DEFAULT 0,
    game_mode VARCHAR(20) NOT NULL CHECK (game_mode IN ('daily_challenge', 'fallphabet_taptile')),
    game_duration_seconds INTEGER,
    max_chain_multiplier INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_game_mode ON leaderboard(game_mode);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_created_at ON leaderboard(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_mode_score ON leaderboard(game_mode, score DESC);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_leaderboard_updated_at 
    BEFORE UPDATE ON leaderboard 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Create policies for leaderboard access
-- Allow anyone to read leaderboard entries (for global leaderboard)
CREATE POLICY "Allow public read access to leaderboard" ON leaderboard
    FOR SELECT USING (true);

-- Allow anyone to insert new scores (for submitting scores)
CREATE POLICY "Allow public insert to leaderboard" ON leaderboard
    FOR INSERT WITH CHECK (true);

-- Optional: Allow users to update their own scores (if you want to implement score updates)
-- This would require user authentication and a user_id column
-- CREATE POLICY "Allow users to update their own scores" ON leaderboard
--     FOR UPDATE USING (auth.uid()::text = user_id);

-- Create a view for top scores by game mode
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

-- Create a function to get top scores for a specific game mode
CREATE OR REPLACE FUNCTION get_top_scores(
    p_game_mode VARCHAR(20),
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    rank INTEGER,
    player_name VARCHAR(50),
    score INTEGER,
    words_used INTEGER,
    game_duration_seconds INTEGER,
    max_chain_multiplier INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY l.score DESC) as rank,
        l.player_name,
        l.score,
        l.words_used,
        l.game_duration_seconds,
        l.max_chain_multiplier,
        l.created_at
    FROM leaderboard l
    WHERE l.game_mode = p_game_mode
    ORDER BY l.score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get player's best score for a game mode
CREATE OR REPLACE FUNCTION get_player_best_score(
    p_player_name VARCHAR(50),
    p_game_mode VARCHAR(20)
)
RETURNS TABLE (
    player_name VARCHAR(50),
    best_score INTEGER,
    words_used INTEGER,
    game_duration_seconds INTEGER,
    max_chain_multiplier INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.player_name,
        l.score as best_score,
        l.words_used,
        l.game_duration_seconds,
        l.max_chain_multiplier,
        l.created_at
    FROM leaderboard l
    WHERE l.player_name = p_player_name 
    AND l.game_mode = p_game_mode
    ORDER BY l.score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing (optional)
-- INSERT INTO leaderboard (player_name, score, words_used, game_mode, game_duration_seconds, max_chain_multiplier) VALUES
-- ('Player1', 150, 8, 'daily_challenge', 120, 3),
-- ('Player2', 200, 12, 'daily_challenge', 180, 4),
-- ('Player3', 175, 10, 'daily_challenge', 150, 3),
-- ('SpeedPlayer', 300, 15, 'fallphabet_taptile', 240, 5),
-- ('FastPlayer', 250, 12, 'fallphabet_taptile', 200, 4);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON leaderboard TO anon;
-- GRANT SELECT, INSERT ON leaderboard TO authenticated;
-- GRANT USAGE ON SCHEMA public TO anon;
-- GRANT USAGE ON SCHEMA public TO authenticated; 