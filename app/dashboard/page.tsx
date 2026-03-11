'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabase, DEFAULT_GAME_CODE } from '@/lib/db';
import { Loader2, Play, SkipForward } from 'lucide-react';

interface Player {
  id: number;
  name: string;
  won: boolean;
  cards?: any[];
}

interface Prompt {
  id: number;
  text: string;
}

interface GameSession {
  id: number;
  code: string;
  status: string;
  current_prompt_index: number;
  total_rounds: number;
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = searchParams.get('code') || DEFAULT_GAME_CODE;

  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get session
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', gameCode)
          .single();

        if (sessionData) {
          setSession(sessionData);
          setGameStarted(sessionData.status === 'playing' || sessionData.status === 'ended');
        }

        // Get players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', sessionData?.id);

        setPlayers(playersData || []);

        // Get all prompts
        const { data: promptsData } = await supabase
          .from('prompts')
          .select('*');

        setAllPrompts(promptsData || []);

        // Get current prompt if game is playing
        if (sessionData && (sessionData.status === 'playing' || sessionData.status === 'ended')) {
          const { data: roundData } = await supabase
            .from('rounds')
            .select('prompt_id, prompts(*)')
            .eq('session_id', sessionData.id)
            .eq('round_number', sessionData.current_prompt_index)
            .single();

          if (roundData?.prompts) {
            setCurrentPrompt(roundData.prompts);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setLoading(false);
      }
    };

    loadData();
  }, [gameCode, router]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameCode) return;

    // Subscribe to session updates
    const sessionSub = supabase
      .channel(`session:${gameCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `code=eq.${gameCode}`,
      }, (payload: any) => {
        setSession(payload.new);
      })
      .subscribe();

    // Subscribe to player updates
    const playersSub = supabase
      .channel(`players:${gameCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${session?.id}`,
      }, async () => {
        // Reload players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', session?.id);

        setPlayers(playersData || []);
      })
      .subscribe();

    return () => {
      sessionSub.unsubscribe();
      playersSub.unsubscribe();
    };
  }, [gameCode, session?.id]);

  const startGame = async () => {
    if (!session) return;

    try {
      // Update session status
      await supabase
        .from('sessions')
        .update({ status: 'playing' })
        .eq('id', session.id);

      // Create initial round
      if (allPrompts.length > 0) {
        const randomPrompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];
        await supabase
          .from('rounds')
          .insert([
            {
              session_id: session.id,
              round_number: 0,
              prompt_id: randomPrompt.id,
            },
          ]);

        setCurrentPrompt(randomPrompt);
      }

      setGameStarted(true);
    } catch (err) {
      console.error('Error starting game:', err);
    }
  };

  const nextPrompt = async () => {
    if (!session || !allPrompts.length) return;

    try {
      const nextIndex = session.current_prompt_index + 1;

      if (nextIndex >= session.total_rounds) {
        // Game over
        await supabase
          .from('sessions')
          .update({ status: 'ended' })
          .eq('id', session.id);
        return;
      }

      // Get random prompt for next round
      const randomPrompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];

      // Create new round
      await supabase
        .from('rounds')
        .insert([
          {
            session_id: session.id,
            round_number: nextIndex,
            prompt_id: randomPrompt.id,
          },
        ]);

      // Update session
      await supabase
        .from('sessions')
        .update({ current_prompt_index: nextIndex })
        .eq('id', session.id);

      setCurrentPrompt(randomPrompt);
    } catch (err) {
      console.error('Error getting next prompt:', err);
    }
  };

  const endGame = async () => {
    if (!session) return;

    try {
      await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', session.id);

      setGameStarted(false);
    } catch (err) {
      console.error('Error ending game:', err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="text-lg text-foreground/70">Loading dashboard...</span>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-foreground/70">Game not found</p>
          <Button onClick={() => router.push('/')}>Back Home</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-accent/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-[var(--accent)]" style={{ fontFamily: 'Fredoka One' }}>
            Host Dashboard
          </h1>
          <p className="text-foreground/70">Game Code: <span className="font-mono font-bold">{session.code}</span></p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Current Prompt */}
            {gameStarted && (
              <div className="glass p-8 space-y-6">
                <div>
                  <p className="text-sm text-foreground/70 mb-2">Current Prompt</p>
                  <p className="text-3xl font-bold text-foreground mb-4">{currentPrompt?.text || 'Loading...'}</p>
                  <p className="text-sm text-foreground/50">
                    Round {session.current_prompt_index + 1} of {session.total_rounds}
                  </p>
                </div>

                {session.status === 'playing' && (
                  <div className="flex gap-3">
                    <Button
                      onClick={nextPrompt}
                      className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 py-6"
                    >
                      <SkipForward className="mr-2 h-5 w-5" />
                      Next Prompt
                    </Button>
                    <Button
                      onClick={endGame}
                      variant="outline"
                      className="flex-1 py-6"
                    >
                      End Game
                    </Button>
                  </div>
                )}

                {session.status === 'ended' && (
                  <div className="text-center p-6 bg-accent/20 border border-accent rounded-lg">
                    <p className="text-xl font-bold text-[var(--accent)]">Game Ended</p>
                  </div>
                )}
              </div>
            )}

            {!gameStarted && (
              <div className="glass p-8 space-y-6 text-center">
                <p className="text-lg text-foreground/70">
                  {players.length > 0
                    ? `${players.length} player(s) joined. Ready to start?`
                    : 'Waiting for players to join...'}
                </p>
                <Button
                  onClick={startGame}
                  disabled={players.length === 0}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-lg neon-glow"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Game
                </Button>
              </div>
            )}
          </div>

          {/* Players Sidebar */}
          <div className="glass p-6 space-y-6">
            <h2 className="text-2xl font-bold text-[var(--accent)]">Players ({players.length})</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {players.length > 0 ? (
                players.map((player) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-lg ${
                      player.won
                        ? 'bg-accent/30 border border-accent'
                        : 'bg-secondary/20 border border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{player.name}</p>
                      {player.won && <span className="text-sm font-bold text-[var(--accent)]">BINGO!</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-foreground/50 text-center py-8">No players yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="glass p-6 flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/play?code=' + gameCode + '&host=true')}
            className="flex-1"
          >
            View Game Board
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="flex-1"
          >
            Exit Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
