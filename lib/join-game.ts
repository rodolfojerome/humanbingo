import { supabase, DEFAULT_GAME_CODE } from '@/lib/db';

export type JoinResult = { ok: true; code: string } | { ok: false; error: string };

/**
 * Ensure the default shared game exists (so no manual DB setup is required).
 */
async function ensureDefaultSession(code: string): Promise<void> {
  if (code !== DEFAULT_GAME_CODE) return;
  await supabase.from('sessions').upsert(
    {
      code: DEFAULT_GAME_CODE,
      admin_id: 'default',
      admin_password: '',
      status: 'waiting',
      current_prompt_index: 0,
      total_rounds: 40,
    },
    { onConflict: 'code', ignoreDuplicates: true }
  );
}

/**
 * Join the shared game: find session by code (creating default game if missing), create player + card, set sessionStorage.
 * Caller should redirect to /play?code=... on ok.
 */
export async function joinGame(code: string, playerName: string): Promise<JoinResult> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode || !playerName.trim()) {
    return { ok: false, error: 'Please enter your name.' };
  }

  try {
    let { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    // If game doesn't exist and this is the default code, create it so no DB setup is needed
    if ((sessionError || !session) && normalizedCode === DEFAULT_GAME_CODE) {
      await ensureDefaultSession(normalizedCode);
      const retry = await supabase.from('sessions').select('*').eq('code', normalizedCode).single();
      session = retry.data;
      sessionError = retry.error;
    }

    if (sessionError || !session) {
      return { ok: false, error: 'Game not found. Please try again.' };
    }

    const userId = crypto.randomUUID();
    const { error: playerError } = await supabase.from('players').insert([
      {
        session_id: session.id,
        name: playerName.trim(),
        user_id: userId,
      },
    ]);

    if (playerError) {
      return { ok: false, error: playerError.message || 'Failed to join.' };
    }

    const { data: prompts } = await supabase.from('prompts').select('*');
    if (!prompts || prompts.length === 0) {
      return { ok: false, error: 'No prompts available.' };
    }

    const shuffled = [...prompts].sort(() => Math.random() - 0.5);
    const cardPrompts = shuffled.slice(0, 25).map((p: { id: number }) => p.id);

    const { data: newPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', userId)
      .eq('session_id', session.id)
      .single();

    if (newPlayer) {
      const { error: cardError } = await supabase.from('cards').insert([
        {
          player_id: newPlayer.id,
          session_id: session.id,
          card_data: cardPrompts,
        },
      ]);
      if (cardError) {
        return { ok: false, error: cardError.message || 'Failed to create card.' };
      }
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('gameCode', normalizedCode);
      sessionStorage.setItem('userId', userId);
      sessionStorage.setItem('playerName', playerName.trim());
    }

    return { ok: true, code: normalizedCode };
  } catch (err) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to join.';
    return { ok: false, error: message };
  }
}
