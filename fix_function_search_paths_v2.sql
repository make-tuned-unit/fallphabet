-- Fix Function Search Path Mutable Issues (Updated with SECURITY DEFINER approach)
-- Run this SQL in your Supabase SQL Editor to fix the security warnings

-- Function: get_daily_seed
CREATE OR REPLACE FUNCTION public.get_daily_seed()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    SET search_path = '';
    -- Use the current date as a seed for consistent daily challenges
    -- This ensures all players get the same tile sequence on the same day
    RETURN EXTRACT(EPOCH FROM CURRENT_DATE)::INTEGER;
END;
$$;

-- Function: has_daily_attempt_today
CREATE OR REPLACE FUNCTION public.has_daily_attempt_today(player_name_param VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_exists BOOLEAN;
BEGIN
    SET search_path = '';
    SELECT EXISTS(
        SELECT 1 FROM public.leaderboard 
        WHERE player_name = player_name_param 
        AND game_mode = 'daily_challenge' 
        AND attempt_date = CURRENT_DATE
    ) INTO attempt_exists;
    
    RETURN json_build_object('has_attempted', attempt_exists);
END;
$$;

-- Function: get_daily_challenge_leaderboard
CREATE OR REPLACE FUNCTION public.get_daily_challenge_leaderboard()
RETURNS TABLE (
  rank INTEGER,
  player_name VARCHAR,
  score INTEGER,
  words_used INTEGER,
  top_word VARCHAR,
  top_word_score INTEGER,
  max_chain_multiplier INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    SET search_path = '';
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
    FROM public.leaderboard l
    WHERE l.game_mode = 'daily_challenge' 
    AND l.attempt_date = CURRENT_DATE
    ORDER BY l.score DESC, l.words_used ASC, l.created_at ASC;
END;
$$;

-- Function: submit_daily_challenge_score
CREATE OR REPLACE FUNCTION public.submit_daily_challenge_score(
  player_name_param VARCHAR,
  score_param INTEGER,
  words_used_param INTEGER,
  top_word_param VARCHAR,
  top_word_score_param INTEGER,
  max_chain_multiplier_param INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  daily_seed_val INTEGER;
BEGIN
    SET search_path = '';
    -- Check if player has already attempted today
    IF public.has_daily_attempt_today(player_name_param) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You have already completed today''s daily challenge. Come back tomorrow!'
        );
    END IF;
    
    -- Get today's seed
    daily_seed_val := public.get_daily_seed();
    
    -- Insert the score
    INSERT INTO public.leaderboard (
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
            SELECT l.rank FROM public.get_daily_challenge_leaderboard() l
            WHERE l.player_name = player_name_param
        ),
        'total_participants', (
            SELECT COUNT(*) FROM public.leaderboard l
            WHERE l.game_mode = 'daily_challenge' 
            AND l.attempt_date = CURRENT_DATE
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    SET search_path = '';
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Function: get_top_scores
CREATE OR REPLACE FUNCTION public.get_top_scores(
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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    SET search_path = '';
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY l.score DESC) as rank,
        l.player_name,
        l.score,
        l.words_used,
        l.game_duration_seconds,
        l.max_chain_multiplier,
        l.created_at
    FROM public.leaderboard l
    WHERE l.game_mode = p_game_mode
    ORDER BY l.score DESC
    LIMIT p_limit;
END;
$$;

-- Function: get_player_best_score
CREATE OR REPLACE FUNCTION public.get_player_best_score(
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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    SET search_path = '';
    RETURN QUERY
    SELECT 
        l.player_name,
        l.score as best_score,
        l.words_used,
        l.game_duration_seconds,
        l.max_chain_multiplier,
        l.created_at
    FROM public.leaderboard l
    WHERE l.player_name = p_player_name 
    AND l.game_mode = p_game_mode
    ORDER BY l.score DESC
    LIMIT 1;
END;
$$;

-- Function: get_daily_seed (from daily challenge setup)
CREATE OR REPLACE FUNCTION public.get_daily_seed(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY DEFINER
IMMUTABLE
AS $$
BEGIN
    SET search_path = '';
    -- Generate a consistent seed based on the date
    -- This ensures all players get the same tile sequence on the same day
    RETURN SUBSTRING(MD5(target_date::TEXT || 'fallphabet_daily_2024'), 1, 10);
END;
$$;

-- Function: has_player_attempted_today
CREATE OR REPLACE FUNCTION public.has_player_attempted_today(
    player_name_param VARCHAR(50),
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    attempt_exists BOOLEAN;
BEGIN
    SET search_path = '';
    SELECT EXISTS(
        SELECT 1 FROM public.daily_challenge_attempts 
        WHERE player_name = player_name_param 
        AND attempt_date = target_date
        AND daily_seed = public.get_daily_seed(target_date)
    ) INTO attempt_exists;
    
    RETURN attempt_exists;
END;
$$;

-- Function: log_daily_attempt
CREATE OR REPLACE FUNCTION public.log_daily_attempt(
    player_name_param VARCHAR(50),
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    daily_seed_val VARCHAR(10);
    attempt_id UUID;
    result JSON;
BEGIN
    SET search_path = '';
    -- Check if player has already attempted today
    IF public.has_player_attempted_today(player_name_param, target_date) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Player has already attempted today''s challenge'
        );
    END IF;
    
    -- Get daily seed
    daily_seed_val := public.get_daily_seed(target_date);
    
    -- Insert attempt record
    INSERT INTO public.daily_challenge_attempts (
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
$$;

-- Function: complete_daily_attempt
CREATE OR REPLACE FUNCTION public.complete_daily_attempt(
    player_name_param VARCHAR(50),
    score_param INTEGER,
    words_used_param INTEGER,
    top_word_param VARCHAR(20),
    top_word_score_param INTEGER,
    highest_chain_param INTEGER,
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    daily_seed_val VARCHAR(10);
    attempt_record RECORD;
    leaderboard_record RECORD;
    rank_position INTEGER;
    total_participants INTEGER;
    result JSON;
BEGIN
    SET search_path = '';
    -- Get daily seed
    daily_seed_val := public.get_daily_seed(target_date);
    
    -- Find the attempt record
    SELECT * INTO attempt_record 
    FROM public.daily_challenge_attempts 
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
    UPDATE public.daily_challenge_attempts 
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
    INSERT INTO public.daily_challenge_leaderboard (
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
        (SELECT COUNT(*) FROM public.daily_challenge_leaderboard WHERE attempt_date = target_date)
    INTO rank_position, total_participants
    FROM public.daily_challenge_leaderboard 
    WHERE attempt_date = target_date 
    AND score > score_param;
    
    RETURN json_build_object(
        'success', true,
        'rank', rank_position,
        'total_participants', total_participants,
        'daily_seed', daily_seed_val
    );
END;
$$;

-- Function: get_todays_leaderboard
CREATE OR REPLACE FUNCTION public.get_todays_leaderboard(
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
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    SET search_path = '';
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY l.score DESC, l.words_used ASC, l.created_at ASC) as rank,
        l.player_name,
        l.score,
        l.words_used,
        l.top_word,
        l.top_word_score,
        l.highest_chain
    FROM public.daily_challenge_leaderboard l
    WHERE l.attempt_date = target_date
    ORDER BY l.score DESC, l.words_used ASC, l.created_at ASC
    LIMIT limit_count;
END;
$$;

-- Function: get_player_todays_score
CREATE OR REPLACE FUNCTION public.get_player_todays_score(
    player_name_param VARCHAR(50),
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    player_score RECORD;
    rank_position INTEGER;
    total_participants INTEGER;
BEGIN
    SET search_path = '';
    -- Get player's score
    SELECT * INTO player_score
    FROM public.daily_challenge_leaderboard
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
        (SELECT COUNT(*) FROM public.daily_challenge_leaderboard WHERE attempt_date = target_date)
    INTO rank_position, total_participants
    FROM public.daily_challenge_leaderboard 
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
$$;

-- Function: cleanup_old_daily_challenge_data
CREATE OR REPLACE FUNCTION public.cleanup_old_daily_challenge_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_leaderboard INTEGER;
    deleted_attempts INTEGER;
BEGIN
    SET search_path = '';
    -- Delete leaderboard entries older than 30 days
    DELETE FROM public.daily_challenge_leaderboard 
    WHERE attempt_date < CURRENT_DATE - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_leaderboard = ROW_COUNT;
    
    -- Delete attempt logs older than 30 days
    DELETE FROM public.daily_challenge_attempts 
    WHERE attempt_date < CURRENT_DATE - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_attempts = ROW_COUNT;
    
    RETURN deleted_leaderboard + deleted_attempts;
END;
$$;

-- Grant permissions to all functions
GRANT EXECUTE ON FUNCTION public.get_daily_seed() TO anon;
GRANT EXECUTE ON FUNCTION public.has_daily_attempt_today(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_daily_challenge_leaderboard() TO anon;
GRANT EXECUTE ON FUNCTION public.submit_daily_challenge_score(VARCHAR, INTEGER, INTEGER, VARCHAR, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_scores(VARCHAR, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_player_best_score(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_daily_seed(DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.has_player_attempted_today(VARCHAR, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.log_daily_attempt(VARCHAR, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.complete_daily_attempt(VARCHAR, INTEGER, INTEGER, VARCHAR, INTEGER, INTEGER, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.get_todays_leaderboard(DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_player_todays_score(VARCHAR, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_daily_challenge_data() TO anon;

-- Also grant to authenticated role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 