'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabase, DEFAULT_GAME_CODE } from '@/lib/db';
import { Loader2 } from 'lucide-react';

interface Prompt {
  id: number;
  text: string;
}

export default function MyMomentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = searchParams.get('code') || DEFAULT_GAME_CODE;

  const [playerName, setPlayerName] = useState('');
  const [confession, setConfession] = useState<string | null>(null);
  const [moments, setMoments] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const storedUserId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('userId') : null;
      const storedName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('playerName') : null;
      if (!storedUserId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const { data: session } = await supabase
          .from('sessions')
          .select('id')
          .eq('code', gameCode)
          .single();

        if (!session) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const { data: player } = await supabase
          .from('players')
          .select('id, name, confession')
          .eq('session_id', session.id)
          .eq('user_id', storedUserId)
          .single();

        if (!player) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setPlayerName(player.name || storedName || 'You');
        setConfession(player.confession || null);

        const { data: cardRow } = await supabase
          .from('cards')
          .select('id, card_data')
          .eq('player_id', player.id)
          .single();

        if (!cardRow?.card_data) {
          setLoading(false);
          return;
        }

        const { data: marks } = await supabase
          .from('card_marks')
          .select('cell_index')
          .eq('card_id', cardRow.id);

        const markedIndices = new Set((marks || []).map((m: { cell_index: number }) => m.cell_index));
        const cardData = cardRow.card_data as number[];
        const promptIds = cardData.filter((_, index) => markedIndices.has(index) && index !== 12);

        if (promptIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data: prompts } = await supabase
          .from('prompts')
          .select('id, text')
          .in('id', promptIds);

        setMoments((prompts || []) as Prompt[]);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [gameCode]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="text-lg text-[var(--muted-foreground)]">Loading your moments...</span>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-lg text-[var(--muted-foreground)]">Could not load your moments. Join a game and get BINGO first!</p>
          <Button onClick={() => router.push('/')}>Back Home</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-64 bg-gradient-to-b from-[var(--accent)]/10 via-transparent to-transparent rounded-b-[50%]" />
      </div>

      <div className="max-w-lg mx-auto space-y-6 pt-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: 'Fredoka One' }}>
            Your embarrassing moments
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2">{playerName}, here’s what you marked on your BINGO card.</p>
        </div>

        {confession && (
          <div className="glass-strong p-5 rounded-2xl">
            <h2 className="text-sm font-bold text-[var(--accent)] mb-2">Your confession</h2>
            <p className="text-[var(--foreground)] whitespace-pre-wrap italic text-sm">{confession}</p>
          </div>
        )}

        <div className="glass-strong p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-[var(--accent)] mb-4">Moments you had (from your BINGO card)</h2>
          <ul className="space-y-2">
            {moments.map((p, i) => (
              <li
                key={p.id}
                className="flex gap-3 p-3 rounded-xl glass-secondary text-[var(--foreground)] text-sm"
              >
                <span className="text-[var(--accent)] font-bold shrink-0">{i + 1}.</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => router.push(`/results?code=${gameCode}`)}
            className="flex-1 h-14 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 font-semibold"
          >
            View all results
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            className="flex-1 h-14 rounded-xl border-[var(--border)]"
          >
            Back Home
          </Button>
        </div>
      </div>
    </main>
  );
}
