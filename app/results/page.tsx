'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabase, DEFAULT_GAME_CODE } from '@/lib/db';
import { Loader2 } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  won: boolean;
  confession: string | null;
}

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = searchParams.get('code') || DEFAULT_GAME_CODE;

  const [players, setPlayers] = useState<Player[]>([]);
  const [winners, setWinners] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        // Get session
        const { data: session } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', gameCode)
          .single();

        if (!session) {
          router.push('/');
          return;
        }

        // Get all players with their confessions
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', session.id);

        setPlayers(playersData || []);
        setWinners((playersData || []).filter((p) => p.won));
        setLoading(false);
      } catch (err) {
        console.error('Error loading results:', err);
        setLoading(false);
      }
    };

    loadResults();
  }, [gameCode, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="text-lg">Loading results...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-6 pb-12">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-64 bg-gradient-to-b from-[var(--accent)]/10 via-transparent to-transparent rounded-b-[50%]" />
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2 pt-4">
          <h1 className="text-3xl font-bold text-[var(--foreground)]" style={{ fontFamily: 'Fredoka One' }}>
            Game Over!
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">Game Code: {gameCode}</p>
        </div>

        {winners.length > 0 && (
          <div className="glass-strong p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-bold text-[var(--accent)]">
              {winners.length === 1 ? '🏆 Winner' : '🏆 Winners'}
            </h2>
            <div className="space-y-4">
              {winners.map((winner) => (
                <div
                  key={winner.id}
                  className="p-5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl space-y-2"
                >
                  <p className="text-2xl font-bold text-foreground">{winner.name}</p>
                  {winner.confession && (
                    <div className="space-y-2">
                      <p className="text-sm text-foreground/70">Their confession:</p>
                      <p className="text-lg italic text-foreground">{winner.confession}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player Confessions - everyone who submitted a confession */}
        {players.filter((p) => p.confession).length > 0 && (
          <div className="glass-strong p-6 rounded-2xl space-y-4">
            <h2 className="text-xl font-bold text-[var(--accent)]">Player Confessions</h2>
            <div className="space-y-4">
              {players
                .filter((p) => p.confession)
                .map((player) => (
                  <div key={player.id} className="p-4 glass-secondary rounded-xl">
                    <p className="font-semibold text-foreground mb-2">
                      {player.name}
                      {player.won && <span className="ml-2 text-xs font-normal text-accent">(BINGO!)</span>}
                    </p>
                    <p className="italic text-foreground/80">{player.confession}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Player List */}
        <div className="glass-strong p-6 rounded-2xl space-y-4">
          <h2 className="text-xl font-bold text-[var(--accent)]">All Players ({players.length})</h2>
          <div className="space-y-2">
            {players.map((player) => (
              <div key={player.id} className="p-4 flex items-center justify-between glass-secondary rounded-xl">
                <p className="font-semibold text-foreground">{player.name}</p>
                {player.won && <span className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm font-bold">BINGO!</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => router.push('/')}
            className="flex-1 h-14 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-lg font-semibold"
          >
            Back Home
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            className="flex-1 h-14 rounded-xl border-[var(--border)] text-lg"
          >
            Play Again
          </Button>
        </div>
      </div>
    </main>
  );
}
