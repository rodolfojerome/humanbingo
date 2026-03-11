import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { sessionId, gameCode } = await request.json();

    if (!sessionId && !gameCode) {
      return NextResponse.json(
        { error: 'Missing sessionId or gameCode' },
        { status: 400 }
      );
    }

    // Get session
    const query = gameCode
      ? supabase.from('sessions').select('*').eq('code', gameCode)
      : supabase.from('sessions').select('*').eq('id', sessionId);

    const { data: session } = await query.single();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if game is over
    if (session.current_prompt_index >= session.total_rounds) {
      return NextResponse.json(
        { error: 'Game is over' },
        { status: 400 }
      );
    }

    // Get all prompts
    const { data: allPrompts } = await supabase
      .from('prompts')
      .select('*');

    if (!allPrompts || allPrompts.length === 0) {
      return NextResponse.json(
        { error: 'No prompts available' },
        { status: 500 }
      );
    }

    // Pick random prompt
    const randomPrompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];

    // Create round
    const { error: roundError } = await supabase
      .from('rounds')
      .insert([
        {
          session_id: session.id,
          round_number: session.current_prompt_index + 1,
          prompt_id: randomPrompt.id,
        },
      ]);

    if (roundError) throw roundError;

    // Update session
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        current_prompt_index: session.current_prompt_index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      prompt: randomPrompt,
      round: session.current_prompt_index + 1,
      totalRounds: session.total_rounds,
    });
  } catch (error) {
    console.error('Error getting next prompt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
