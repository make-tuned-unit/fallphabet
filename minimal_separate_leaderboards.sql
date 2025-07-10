-- Minimal Fallphabet Separate Leaderboards Setup
-- This script creates just the basic tables and policies
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
CREATE POLICY "Allow public read access to taptile_leaderboard" ON taptile_leaderboard
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to taptile_leaderboard" ON taptile_leaderboard
    FOR INSERT WITH CHECK (true);

-- 5. Create RLS policies for Daily Challenge Leaderboard
CREATE POLICY "Allow public read access to daily_challenge_leaderboard" ON daily_challenge_leaderboard
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to daily_challenge_leaderboard" ON daily_challenge_leaderboard
    FOR INSERT WITH CHECK (true);

-- 6. Grant necessary permissions
GRANT ALL ON taptile_leaderboard TO anon;
GRANT ALL ON daily_challenge_leaderboard TO anon;

-- 7. Verify setup
SELECT 'Taptile Leaderboard' as table_name, COUNT(*) as record_count FROM taptile_leaderboard
UNION ALL
SELECT 'Daily Challenge Leaderboard' as table_name, COUNT(*) as record_count FROM daily_challenge_leaderboard; 