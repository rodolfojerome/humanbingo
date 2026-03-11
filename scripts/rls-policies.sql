-- Run this in Supabase Dashboard → SQL Editor after running setup-db.sql
-- Allows the app (anon key) to create and manage game sessions without auth

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

-- Prompts: anyone can read
DROP POLICY IF EXISTS "Allow read prompts" ON prompts;
CREATE POLICY "Allow read prompts" ON prompts FOR SELECT TO anon USING (true);

-- Sessions: anyone can insert (create game), read, update (host controls)
DROP POLICY IF EXISTS "Allow all sessions" ON sessions;
CREATE POLICY "Allow all sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Players: anyone can insert (join), read, update (confession, won)
DROP POLICY IF EXISTS "Allow all players" ON players;
CREATE POLICY "Allow all players" ON players FOR ALL TO anon USING (true) WITH CHECK (true);

-- Cards: anyone can insert/read/update
DROP POLICY IF EXISTS "Allow all cards" ON cards;
CREATE POLICY "Allow all cards" ON cards FOR ALL TO anon USING (true) WITH CHECK (true);

-- Card marks: anyone can insert/read/update
DROP POLICY IF EXISTS "Allow all card_marks" ON card_marks;
CREATE POLICY "Allow all card_marks" ON card_marks FOR ALL TO anon USING (true) WITH CHECK (true);

-- Rounds: anyone can insert/read/update
DROP POLICY IF EXISTS "Allow all rounds" ON rounds;
CREATE POLICY "Allow all rounds" ON rounds FOR ALL TO anon USING (true) WITH CHECK (true);
