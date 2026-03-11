-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  admin_id TEXT NOT NULL,
  admin_password TEXT NOT NULL,
  status TEXT DEFAULT 'waiting',
  current_prompt_index INT DEFAULT 0,
  total_rounds INT DEFAULT 40,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  confession TEXT,
  won BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cards table (5x5 grid)
CREATE TABLE IF NOT EXISTS cards (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  card_data JSONB NOT NULL, -- Array of 25 prompt IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create card marks table (tracks which cells are marked)
CREATE TABLE IF NOT EXISTS card_marks (
  id BIGSERIAL PRIMARY KEY,
  card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  cell_index INT NOT NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create rounds table
CREATE TABLE IF NOT EXISTS rounds (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  prompt_id BIGINT REFERENCES prompts(id),
  displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_cards_player_id ON cards(player_id);
CREATE INDEX IF NOT EXISTS idx_card_marks_card_id ON card_marks(card_id);
CREATE INDEX IF NOT EXISTS idx_rounds_session_id ON rounds(session_id);

-- One shared game (no lobbies, no admin). Code is hardcoded in the app as BINGO.
INSERT INTO sessions (code, admin_id, admin_password, status, current_prompt_index, total_rounds)
VALUES ('BINGO', 'default', '', 'waiting', 0, 40)
ON CONFLICT (code) DO NOTHING;

-- Seed prompts: Tagalog/Filipino office embarrassing moments + office
INSERT INTO prompts (text, category) VALUES
('Nakalimutang i-unmute at nagsalita nang malakas sa background', 'embarrassing'),
('Nahuli na kumakain habang nasa video call', 'embarrassing'),
('Nagsalita habang naka-off ang camera, pero hindi pala naka-off', 'embarrassing'),
('Na-freeze ang mukha sa pinaka-awkward na frame sa Zoom', 'embarrassing'),
('Nagkamali ng pronunciation ng pangalan ng kliyente', 'embarrassing'),
('Nagsabi ng joke na hindi natawa ang lahat', 'embarrassing'),
('Nakalimutang mag-save ng presentation at nawala lahat ng edits', 'embarrassing'),
('Nagkamali ng pag-share ng confidential file sa maling tao', 'embarrassing'),
('Nahuli na naglalaro ng mobile game habang nasa meeting', 'embarrassing'),
('Nagsabi ng "good night" imbes na "good morning" sa opening ng call', 'embarrassing'),
('Nakapagpadala ng email sa maling tao (kliyente o boss)', 'embarrassing'),
('Nakakatulog sa Zoom call', 'embarrassing'),
('Nagkaroon ng typo sa client-facing email o post', 'embarrassing'),
('Nag-reply-all sa company-wide email nang aksidente', 'embarrassing'),
('Naka-mute ng 2 minuto habang nagsasalita', 'embarrassing'),
('Natapunan ng kape ang laptop o keyboard', 'embarrassing'),
('Nakalimutan ang pangalan ng isang tao sa meeting', 'embarrassing'),
('Natapilok o nadapa sa opisina', 'embarrassing'),
('Nahuli na nag-i-Instagram habang nasa call', 'embarrassing'),
('Nasabi ang mali sa meeting', 'embarrassing'),
('Pumasok sa maling meeting room', 'embarrassing'),
('Nag-share screen nang may nakakahiyang laman', 'embarrassing'),
('Umiyak sa trabaho (sa desk o banyo)', 'embarrassing'),
('Nagpadala ng DM tungkol sa isang tao sa mismong taong iyon', 'embarrassing'),
('Nagkunwaring nagtatrabaho pero nag-o-online shopping', 'embarrassing'),
('Nahuli na nagrereklamo tungkol sa meeting sa meeting chat mismo', 'embarrassing'),
('Nasabi ang boss na "mom" o "dad" nang aksidente', 'embarrassing'),
('Nakakain ng lunch ng iba mula sa fridge', 'embarrassing'),
('Nagkaroon ng wardrobe malfunction sa opisina', 'embarrassing'),
('Tumawa sa joke na walang nakaintindi', 'embarrassing'),
('Nasa meeting pero walang ideya kung tungkol saan ito', 'embarrassing'),
('Poo in the office comfort room', 'office'),
('Late more than 5 mins', 'office'),
('Sick but go to work', 'office'),
('Ayaw ng ulam', 'office'),
('Tinatamad mag goodmorning', 'office'),
('Napapagod na ngumiti', 'office'),
('Nagseselpon sa work', 'office'),
('Nagccr para maubos oras', 'office'),
('Iintayin magrefill ng kape bago kumuha', 'office'),
('Galit sa kawork', 'office'),
('Weak ang OJT', 'office'),
('Nakakatawa si Aze (OJT)', 'office'),
('Ambait ni kuya A', 'office'),
('Nakakatawa si kuya Raf', 'office'),
('Ang ganda ni ate Aly', 'office'),
('Ang ganda ni ate Kiah', 'office'),
('Ang ganda ni ate Sey', 'office')
ON CONFLICT (text) DO NOTHING;

-- Note: Enable realtime for specific tables in Supabase dashboard under Replication settings
