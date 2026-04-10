-- One-time: remove test user submissions before launch.
-- Keeps NHTSA/CPUC/DMV and all bulletin_items (Reddit) data.
-- Run in Supabase SQL Editor with appropriate privileges.

-- Preview:
-- SELECT id, created_at, city, status FROM incidents WHERE source = 'user_report';

DELETE FROM incidents
WHERE source = 'user_report';
