import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { playerId, cardId, cellIndex, action } = await request.json();

    if (!playerId || !cardId || cellIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (action === 'mark') {
      // Add mark
      const { error } = await supabase
        .from('card_marks')
        .insert([
          {
            card_id: cardId,
            cell_index: cellIndex,
          },
        ]);

      if (error) throw error;
    } else if (action === 'unmark') {
      // Remove mark
      const { error } = await supabase
        .from('card_marks')
        .delete()
        .eq('card_id', cardId)
        .eq('cell_index', cellIndex);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking cell:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
