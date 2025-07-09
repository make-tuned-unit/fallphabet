-- =====================================================
-- Fallphabet Daily Challenge Leaderboard Setup
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. DAILY CHALLENGE LEADERBOARD TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_challenge_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_name VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL,
    words_used INTEGER NOT NULL,
    top_word VARCHAR(20),
    top_word_score INTEGER,
    highest_chain INTEGER DEFAULT 1,
    attempt_date DATE NOT NULL,
    daily_seed VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. DAILY CHALLENGE ATTEMPTS LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_challenge_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_name VARCHAR(50) NOT NULL,
    attempt_date DATE NOT NULL,
    daily_seed VARCHAR(10) NOT NULL,
    score INTEGER,
    words_used INTEGER,
    top_word VARCHAR(20),
    top_word_score INTEGER,
    highest_chain INTEGER DEFAULT 1,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one attempt per player per day per seed
    UNIQUE(player_name, attempt_date, daily_seed)
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Daily Challenge Leaderboard indexes
CREATE INDEX IF NOT EXISTS idx_daily_challenge_date ON daily_challenge_leaderboard(attempt_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_score ON daily_challenge_leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_player_date ON daily_challenge_leaderboard(player_name, attempt_date);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_seed ON daily_challenge_leaderboard(daily_seed);

-- Daily Challenge Attempts indexes
CREATE INDEX IF NOT EXISTS idx_attempts_player_date ON daily_challenge_attempts(player_name, attempt_date);
CREATE INDEX IF NOT EXISTS idx_attempts_date_seed ON daily_challenge_attempts(attempt_date, daily_seed);
CREATE INDEX IF NOT EXISTS idx_attempts_completed ON daily_challenge_attempts(completed);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE daily_challenge_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access to leaderboard
CREATE POLICY "Allow anonymous read access to daily challenge leaderboard" ON daily_challenge_leaderboard
    FOR SELECT USING (true);

-- Allow anonymous insert/update for leaderboard submissions
CREATE POLICY "Allow anonymous insert to daily challenge leaderboard" ON daily_challenge_leaderboard
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update to daily challenge leaderboard" ON daily_challenge_leaderboard
    FOR UPDATE USING (true);

-- Allow anonymous read access to attempts (for checking if player has already attempted)
CREATE POLICY "Allow anonymous read access to daily challenge attempts" ON daily_challenge_attempts
    FOR SELECT USING (true);

-- Allow anonymous insert for attempt logging
CREATE POLICY "Allow anonymous insert to daily challenge attempts" ON daily_challenge_attempts
    FOR INSERT WITH CHECK (true);

-- Allow anonymous update for attempt completion
CREATE POLICY "Allow anonymous update to daily challenge attempts" ON daily_challenge_attempts
    FOR UPDATE USING (true);

-- =====================================================
-- 5. FUNCTIONS FOR DAILY CHALLENGE MANAGEMENT
-- =====================================================

-- Function to generate daily seed (consistent for all players on same day)
CREATE OR REPLACE FUNCTION get_daily_seed(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VARCHAR(10) AS $$
BEGIN
    -- Generate a consistent seed based on the date
    -- This ensures all players get the same tile sequence on the same day
    RETURN SUBSTRING(MD5(target_date::TEXT || 'fallphabet_daily_2024'), 1, 10);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if player has already attempted today's challenge
CREATE OR REPLACE FUNCTION has_player_attempted_today(
    player_name_param VARCHAR(50),
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
    attempt_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM daily_challenge_attempts 
        WHERE player_name = player_name_param 
        AND attempt_date = target_date
        AND daily_seed = get_daily_seed(target_date)
    ) INTO attempt_exists;
    
    RETURN attempt_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log a new attempt
CREATE OR REPLACE FUNCTION log_daily_attempt(
    player_name_param VARCHAR(50),
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    daily_seed_val VARCHAR(10);
    attempt_id UUID;
    result JSON;
BEGIN
    -- Check if player has already attempted today
    IF has_player_attempted_today(player_name_param, target_date) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Player has already attempted today''s challenge'
        );
    END IF;
    
    -- Get daily seed
    daily_seed_val := get_daily_seed(target_date);
    
    -- Insert attempt record
    INSERT INTO daily_challenge_attempts (
        player_name, 
        attempt_date, 
        daily_seed
    ) VALUES (
        player_name_param, 
        target_date, 
        daily_seed_val
    ) RETURNING id INTO attempt_id;
    
    RETURN json_build_object(
        'success', true,
        'attempt_id', attempt_id,
        'daily_seed', daily_seed_val
    );
END;
$$ LANGUAGE plpgsql;

-- Function to complete an attempt and submit score
CREATE OR REPLACE FUNCTION complete_daily_attempt(
    player_name_param VARCHAR(50),
    score_param INTEGER,
    words_used_param INTEGER,
    top_word_param VARCHAR(20),
    top_word_score_param INTEGER,
    highest_chain_param INTEGER,
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    daily_seed_val VARCHAR(10);
    attempt_record RECORD;
    leaderboard_record RECORD;
    rank_position INTEGER;
    total_participants INTEGER;
    result JSON;
BEGIN
    -- Get daily seed
    daily_seed_val := get_daily_seed(target_date);
    
    -- Find the attempt record
    SELECT * INTO attempt_record 
    FROM daily_challenge_attempts 
    WHERE player_name = player_name_param 
    AND attempt_date = target_date 
    AND daily_seed = daily_seed_val;
    
    -- Check if attempt exists and is not completed
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No attempt found for today'
        );
    END IF;
    
    IF attempt_record.completed THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Attempt already completed'
        );
    END IF;
    
    -- Update attempt record with score
    UPDATE daily_challenge_attempts 
    SET 
        score = score_param,
        words_used = words_used_param,
        top_word = top_word_param,
        top_word_score = top_word_score_param,
        highest_chain = highest_chain_param,
        completed = TRUE,
        updated_at = NOW()
    WHERE id = attempt_record.id;
    
    -- Insert into leaderboard
    INSERT INTO daily_challenge_leaderboard (
        player_name,
        score,
        words_used,
        top_word,
        top_word_score,
        highest_chain,
        attempt_date,
        daily_seed
    ) VALUES (
        player_name_param,
        score_param,
        words_used_param,
        top_word_param,
        top_word_score_param,
        highest_chain_param,
        target_date,
        daily_seed_val
    );
    
    -- Get rank and total participants
    SELECT 
        COUNT(*) + 1,
        (SELECT COUNT(*) FROM daily_challenge_leaderboard WHERE attempt_date = target_date)
    INTO rank_position, total_participants
    FROM daily_challenge_leaderboard 
    WHERE attempt_date = target_date 
    AND score > score_param;
    
    RETURN json_build_object(
        'success', true,
        'rank', rank_position,
        'total_participants', total_participants,
        'daily_seed', daily_seed_val
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get today's leaderboard
CREATE OR REPLACE FUNCTION get_todays_leaderboard(
    target_date DATE DEFAULT CURRENT_DATE,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    rank INTEGER,
    player_name VARCHAR(50),
    score INTEGER,
    words_used INTEGER,
    top_word VARCHAR(20),
    top_word_score INTEGER,
    highest_chain INTEGER
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
        l.highest_chain
    FROM daily_challenge_leaderboard l
    WHERE l.attempt_date = target_date
    ORDER BY l.score DESC, l.words_used ASC, l.created_at ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get player's best score for today
CREATE OR REPLACE FUNCTION get_player_todays_score(
    player_name_param VARCHAR(50),
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    player_score RECORD;
    rank_position INTEGER;
    total_participants INTEGER;
BEGIN
    -- Get player's score
    SELECT * INTO player_score
    FROM daily_challenge_leaderboard
    WHERE player_name = player_name_param 
    AND attempt_date = target_date;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No score found for today'
        );
    END IF;
    
    -- Get rank
    SELECT 
        COUNT(*) + 1,
        (SELECT COUNT(*) FROM daily_challenge_leaderboard WHERE attempt_date = target_date)
    INTO rank_position, total_participants
    FROM daily_challenge_leaderboard 
    WHERE attempt_date = target_date 
    AND score > player_score.score;
    
    RETURN json_build_object(
        'success', true,
        'score', player_score.score,
        'words_used', player_score.words_used,
        'top_word', player_score.top_word,
        'top_word_score', player_score.top_word_score,
        'highest_chain', player_score.highest_chain,
        'rank', rank_position,
        'total_participants', total_participants
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 6. TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_daily_challenge_leaderboard_updated_at
    BEFORE UPDATE ON daily_challenge_leaderboard
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_challenge_attempts_updated_at
    BEFORE UPDATE ON daily_challenge_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. CLEANUP FUNCTION (Optional - for maintenance)
-- =====================================================

-- Function to clean up old data (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_daily_challenge_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_leaderboard INTEGER;
    deleted_attempts INTEGER;
BEGIN
    -- Delete leaderboard entries older than 30 days
    DELETE FROM daily_challenge_leaderboard 
    WHERE attempt_date < CURRENT_DATE - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_leaderboard = ROW_COUNT;
    
    -- Delete attempt logs older than 30 days
    DELETE FROM daily_challenge_attempts 
    WHERE attempt_date < CURRENT_DATE - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_attempts = ROW_COUNT;
    
    RETURN deleted_leaderboard + deleted_attempts;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. EXAMPLE USAGE COMMENTS
-- =====================================================

/*
EXAMPLE USAGE:

1. Check if player has attempted today:
   SELECT has_player_attempted_today('PlayerName');

2. Log a new attempt:
   SELECT log_daily_attempt('PlayerName');

3. Complete an attempt with score:
   SELECT complete_daily_attempt('PlayerName', 250, 5, 'QUIZ', 22, 3);

4. Get today's leaderboard:
   SELECT * FROM get_todays_leaderboard();

5. Get player's score for today:
   SELECT get_player_todays_score('PlayerName');

6. Clean up old data:
   SELECT cleanup_old_daily_challenge_data();
*/

-- =====================================================
-- 9. GRANT PERMISSIONS (if using service role)
-- =====================================================

-- Grant permissions to anon role (for client-side access)
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Grant permissions to authenticated role (if using auth)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 