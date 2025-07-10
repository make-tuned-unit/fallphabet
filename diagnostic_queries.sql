-- Fallphabet Database Diagnostic Queries
-- Run these queries in your Supabase SQL Editor to investigate score submission issues

-- 1. Check current data in the leaderboard table
SELECT 
    id,
    player_name,
    score,
    words_used,
    game_mode,
    game_duration_seconds,
    max_chain_multiplier,
    created_at,
    updated_at
FROM leaderboard
ORDER BY created_at DESC
LIMIT 20;

-- 2. Count entries by player name to see if there's a pattern
SELECT 
    player_name,
    COUNT(*) as entry_count,
    MIN(created_at) as first_entry,
    MAX(created_at) as last_entry,
    AVG(score) as avg_score,
    MAX(score) as best_score
FROM leaderboard
GROUP BY player_name
ORDER BY entry_count DESC;

-- 3. Check for any recent failed insertions or errors
-- Look for entries with unusual patterns
SELECT 
    player_name,
    score,
    game_mode,
    created_at,
    CASE 
        WHEN player_name IS NULL OR player_name = '' THEN 'NULL_OR_EMPTY_NAME'
        WHEN score <= 0 THEN 'INVALID_SCORE'
        WHEN game_mode NOT IN ('daily_challenge', 'fallphabet_taptile') THEN 'INVALID_MODE'
        ELSE 'VALID_ENTRY'
    END as entry_status
FROM leaderboard
WHERE 
    player_name IS NULL 
    OR player_name = '' 
    OR score <= 0 
    OR game_mode NOT IN ('daily_challenge', 'fallphabet_taptile')
ORDER BY created_at DESC;

-- 4. Check Row Level Security (RLS) policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'leaderboard';

-- 5. Check table permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'leaderboard';

-- 6. Check if there are any constraints preventing inserts
SELECT 
    constraint_name,
    constraint_type,
    table_name,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'leaderboard';

-- 7. Check for any triggers that might be blocking inserts
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'leaderboard';

-- 8. Test insert permissions with a sample entry
-- (This will help identify if the issue is with permissions)
INSERT INTO leaderboard (
    player_name, 
    score, 
    words_used, 
    game_mode, 
    game_duration_seconds, 
    max_chain_multiplier
) VALUES (
    'TEST_PLAYER_' || EXTRACT(EPOCH FROM NOW())::INTEGER,
    100,
    5,
    'fallphabet_taptile',
    60,
    2
) ON CONFLICT DO NOTHING;

-- 9. Check for any recent database errors or logs
-- (This might not be available in Supabase, but worth checking)
SELECT 
    log_time,
    user_name,
    database_name,
    process_id,
    session_id,
    command_tag,
    message
FROM pg_stat_activity 
WHERE state = 'active' 
AND query LIKE '%leaderboard%'
ORDER BY log_time DESC
LIMIT 10;

-- 10. Check if there are any unique constraints that might be causing conflicts
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'leaderboard';

-- 11. Check for any daily challenge unique constraints specifically
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'leaderboard' 
AND indexname LIKE '%daily%';

-- 12. Test the daily challenge unique constraint
-- This will show if there are conflicts with the daily challenge unique constraint
SELECT 
    player_name,
    attempt_date,
    COUNT(*) as attempts_on_date
FROM leaderboard
WHERE game_mode = 'daily_challenge'
GROUP BY player_name, attempt_date
HAVING COUNT(*) > 1
ORDER BY attempts_on_date DESC;

-- 13. Check for any recent database connection issues
-- Look for patterns in submission times
SELECT 
    DATE_TRUNC('hour', created_at) as hour_bucket,
    COUNT(*) as submissions,
    COUNT(DISTINCT player_name) as unique_players
FROM leaderboard
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;

-- 14. Check if there are any issues with the player_name field specifically
SELECT 
    LENGTH(player_name) as name_length,
    COUNT(*) as count,
    MIN(player_name) as sample_name
FROM leaderboard
GROUP BY LENGTH(player_name)
ORDER BY name_length;

-- 15. Look for any entries with special characters or encoding issues
SELECT 
    player_name,
    score,
    game_mode,
    created_at,
    LENGTH(player_name) as name_length,
    ASCII(SUBSTRING(player_name, 1, 1)) as first_char_ascii
FROM leaderboard
WHERE 
    player_name ~ '[^a-zA-Z0-9\s\-_]'  -- Contains special characters
    OR LENGTH(player_name) > 50        -- Name too long
    OR LENGTH(player_name) < 1         -- Name too short
ORDER BY created_at DESC;

-- 16. Check if there are any timezone-related issues
SELECT 
    player_name,
    created_at,
    created_at AT TIME ZONE 'UTC' as utc_time,
    created_at AT TIME ZONE 'America/New_York' as est_time
FROM leaderboard
ORDER BY created_at DESC
LIMIT 10;

-- 17. Test the daily challenge functions
-- Check if the has_daily_attempt_today function is working
SELECT has_daily_attempt_today('TEST_PLAYER');

-- 18. Check if there are any issues with the RPC functions
-- This will show if the submit_daily_challenge_score function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name LIKE '%daily%' 
OR routine_name LIKE '%submit%';

-- 19. Summary query - Get overall statistics
SELECT 
    'Total Entries' as metric,
    COUNT(*) as value
FROM leaderboard
UNION ALL
SELECT 
    'Unique Players',
    COUNT(DISTINCT player_name)
FROM leaderboard
UNION ALL
SELECT 
    'Daily Challenge Entries',
    COUNT(*)
FROM leaderboard
WHERE game_mode = 'daily_challenge'
UNION ALL
SELECT 
    'Taptile Entries',
    COUNT(*)
FROM leaderboard
WHERE game_mode = 'fallphabet_taptile'
UNION ALL
SELECT 
    'Entries Today',
    COUNT(*)
FROM leaderboard
WHERE DATE(created_at) = CURRENT_DATE
UNION ALL
SELECT 
    'Entries This Week',
    COUNT(*)
FROM leaderboard
WHERE created_at >= NOW() - INTERVAL '7 days'; 