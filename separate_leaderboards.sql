-- Fallphabet Separate Leaderboards Setup
-- This script creates robust, separate tables for Taptile and Daily Challenge leaderboards
-- Run this entire script in your Supabase SQL Editor

-- 1. Create Taptile Leaderboard Table
CREATE TABLE IF NOT EXISTS taptile_leaderboard (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name text NOT NULL,
    score integer NOT NULL,
    words_used integer,
    game_duration_seconds integer,
    max_chain_multiplier integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create Daily Challenge Leaderboard Table
CREATE TABLE IF NOT EXISTS daily_challenge_leaderboard (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name text NOT NULL,
    score integer NOT NULL,
    words_used integer,
    game_duration_seconds integer,
    max_chain_multiplier integer,
    challenge_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security (RLS) on both tables
ALTER TABLE taptile_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for Taptile Leaderboard
-- Allow anyone to read scores
CREATE POLICY "Allow public read access to taptile_leaderboard" ON taptile_leaderboard
    FOR SELECT USING (true);

-- Allow anyone to insert scores
CREATE POLICY "Allow public insert access to taptile_leaderboard" ON taptile_leaderboard
    FOR INSERT WITH CHECK (true);

-- 5. Create RLS policies for Daily Challenge Leaderboard
-- Allow anyone to read scores
CREATE POLICY "Allow public read access to daily_challenge_leaderboard" ON daily_challenge_leaderboard
    FOR SELECT USING (true);

-- Allow anyone to insert scores
CREATE POLICY "Allow public insert access to daily_challenge_leaderboard" ON daily_challenge_leaderboard
    FOR INSERT WITH CHECK (true);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_taptile_leaderboard_score ON taptile_leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_taptile_leaderboard_created_at ON taptile_leaderboard(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taptile_leaderboard_player_name ON taptile_leaderboard(player_name);

CREATE INDEX IF NOT EXISTS idx_daily_challenge_leaderboard_score ON daily_challenge_leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_leaderboard_challenge_date ON daily_challenge_leaderboard(challenge_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_leaderboard_created_at ON daily_challenge_leaderboard(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_leaderboard_player_name ON daily_challenge_leaderboard(player_name);

-- 7. Optional: Migrate existing data from shared leaderboard table (if it exists)
-- This will safely migrate any existing data without errors if the table doesn't exist
DO $$
BEGIN
    -- Check if the old leaderboard table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leaderboard') THEN
        -- Migrate Taptile scores (where game_mode is 'taptile' or NULL)
        INSERT INTO taptile_leaderboard (player_name, score, words_used, game_duration_seconds, max_chain_multiplier, created_at)
        SELECT 
            player_name,
            score,
            words_used,
            game_duration_seconds,
            max_chain_multiplier,
            created_at
        FROM leaderboard
        WHERE game_mode = 'taptile' OR game_mode IS NULL
        ON CONFLICT DO NOTHING;
        
        -- Migrate Daily Challenge scores (where game_mode is 'daily')
        INSERT INTO daily_challenge_leaderboard (player_name, score, words_used, game_duration_seconds, max_chain_multiplier, challenge_date, created_at)
        SELECT 
            player_name,
            score,
            words_used,
            game_duration_seconds,
            max_chain_multiplier,
            DATE(created_at) as challenge_date,
            created_at
        FROM leaderboard
        WHERE game_mode = 'daily'
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Migration completed successfully';
    ELSE
        RAISE NOTICE 'No existing leaderboard table found - skipping migration';
    END IF;
END $$;

-- 8. Create views for easy querying (optional but recommended)
-- Top Taptile scores view
CREATE OR REPLACE VIEW top_taptile_scores AS
SELECT 
    player_name,
    score,
    words_used,
    game_duration_seconds,
    max_chain_multiplier,
    created_at,
    ROW_NUMBER() OVER (ORDER BY score DESC) as rank
FROM taptile_leaderboard
ORDER BY score DESC;

-- Top Daily Challenge scores view
CREATE OR REPLACE VIEW top_daily_challenge_scores AS
SELECT 
    player_name,
    score,
    words_used,
    game_duration_seconds,
    max_chain_multiplier,
    challenge_date,
    created_at,
    ROW_NUMBER() OVER (ORDER BY score DESC) as rank
FROM daily_challenge_leaderboard
ORDER BY score DESC;

-- 9. Grant necessary permissions
GRANT ALL ON taptile_leaderboard TO anon;
GRANT ALL ON daily_challenge_leaderboard TO anon;
GRANT ALL ON top_taptile_scores TO anon;
GRANT ALL ON top_daily_challenge_scores TO anon;

-- 10. Verify setup
SELECT 'Taptile Leaderboard' as table_name, COUNT(*) as record_count FROM taptile_leaderboard
UNION ALL
SELECT 'Daily Challenge Leaderboard' as table_name, COUNT(*) as record_count FROM daily_challenge_leaderboard; 