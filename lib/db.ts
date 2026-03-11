import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.example).'
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}

export const supabase = getSupabaseClient();

// Single shared game: no lobbies, no admin. Set NEXT_PUBLIC_DEFAULT_GAME_CODE in .env to override.
export const DEFAULT_GAME_CODE = process.env.NEXT_PUBLIC_DEFAULT_GAME_CODE || 'BINGO';

// Initialize database tables
export async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS prompts (
          id BIGSERIAL PRIMARY KEY,
          text TEXT NOT NULL UNIQUE,
          category TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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

        CREATE TABLE IF NOT EXISTS players (
          id BIGSERIAL PRIMARY KEY,
          session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          confession TEXT,
          won BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cards (
          id BIGSERIAL PRIMARY KEY,
          player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          card_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS card_marks (
          id BIGSERIAL PRIMARY KEY,
          card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          cell_index INT NOT NULL,
          marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS rounds (
          id BIGSERIAL PRIMARY KEY,
          session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          round_number INT NOT NULL,
          prompt_id BIGINT REFERENCES prompts(id),
          displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
        CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
        CREATE INDEX IF NOT EXISTS idx_cards_player_id ON cards(player_id);
        CREATE INDEX IF NOT EXISTS idx_card_marks_card_id ON card_marks(card_id);
        CREATE INDEX IF NOT EXISTS idx_rounds_session_id ON rounds(session_id);
      `
    });

    if (error) {
      console.error('Database initialization error:', error);
      return false;
    }

    // Seed prompts if table is empty
    const { count } = await supabase
      .from('prompts')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      const prompts = [
        { text: 'Has pretended to work from home', category: 'workplace' },
        { text: 'Has cried at a movie', category: 'emotions' },
        { text: 'Has texted the wrong person something embarrassing', category: 'texting' },
        { text: 'Has sent a drunk text', category: 'texting' },
        { text: 'Has fallen asleep at work', category: 'workplace' },
        { text: 'Has pretended not to see someone to avoid them', category: 'social' },
        { text: 'Has worn the same outfit twice in a week', category: 'fashion' },
        { text: 'Has eaten something that fell on the floor', category: 'food' },
        { text: 'Has Googled their own name', category: 'internet' },
        { text: 'Has stalked someone on social media', category: 'internet' },
        { text: 'Has made a New Year\'s resolution they forgot about', category: 'goals' },
        { text: 'Has called in sick when not actually sick', category: 'workplace' },
        { text: 'Has sung in the shower', category: 'music' },
        { text: 'Has danced alone in their room', category: 'music' },
        { text: 'Has rewatched a TV series they\'ve already seen', category: 'entertainment' },
        { text: 'Has pretended to laugh at a joke they didn\'t understand', category: 'social' },
        { text: 'Has misspelled someone\'s name in an important email', category: 'workplace' },
        { text: 'Has worn mismatched socks', category: 'fashion' },
        { text: 'Has sniffed their own armpit to check if they smell', category: 'hygiene' },
        { text: 'Has picked their nose in the car', category: 'hygiene' },
        { text: 'Has eaten dessert before dinner', category: 'food' },
        { text: 'Has taken a selfie they were not satisfied with and deleted', category: 'social' },
        { text: 'Has walked into a glass door or window', category: 'accidents' },
        { text: 'Has tripped in public', category: 'accidents' },
        { text: 'Has said something awkward in an elevator and left before responding', category: 'social' },
        { text: 'Has seen themselves in a store mirror and thought they looked cool', category: 'vanity' },
        { text: 'Has pretended to be sleeping to avoid interaction', category: 'social' },
        { text: 'Has checked their phone before getting out of bed', category: 'habits' },
        { text: 'Has spent more than an hour scrolling social media', category: 'internet' },
        { text: 'Has changed their shower routine after hearing a trick on the internet', category: 'habits' },
        { text: 'Has bitten their nails', category: 'habits' },
        { text: 'Has made eye contact with a stranger and immediately looked away', category: 'social' },
        { text: 'Has laughed out loud alone at their phone', category: 'internet' },
        { text: 'Has tried on clothes that don\'t fit just to know the size', category: 'fashion' },
        { text: 'Has walked into the wrong bathroom', category: 'accidents' },
        { text: 'Has repeated something someone said to hear it again', category: 'social' },
        { text: 'Has watched the same YouTube video multiple times', category: 'entertainment' },
        { text: 'Has deleted an awkward text before sending', category: 'texting' },
        { text: 'Has pretended to not see a message notification', category: 'texting' },
        { text: 'Has caught someone else\'s yawn', category: 'contagious' },
      ];

      await supabase
        .from('prompts')
        .insert(prompts);
    }

    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Game utilities
export function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generateBingoCard(prompts: any[]): number[] {
  // Shuffle and pick 25 prompts for the card (12 + 12 + center=free)
  const shuffled = [...prompts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 25).map((p: any) => p.id);
}

export function checkBingo(marked: Set<number>): boolean {
  // Check all 12 winning conditions (5 rows + 5 cols + 2 diagonals)
  const lines = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  return lines.some(line => line.every(index => marked.has(index)));
}

/** Advance to the next prompt (for "Next" / skip when nobody has it). Returns true if advanced, false if game ended or error. */
export async function advanceToNextPrompt(
  sessionId: number,
  currentIndex: number,
  totalRounds: number
): Promise<boolean> {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= totalRounds) {
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', sessionId);
    return false;
  }
  const { data: prompts } = await supabase.from('prompts').select('id');
  if (!prompts || prompts.length === 0) return false;
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  const { error: roundError } = await supabase.from('rounds').insert([
    { session_id: sessionId, round_number: nextIndex, prompt_id: randomPrompt.id },
  ]);
  if (roundError) return false;
  const { error: sessionError } = await supabase
    .from('sessions')
    .update({ current_prompt_index: nextIndex })
    .eq('id', sessionId);
  return !sessionError;
}
