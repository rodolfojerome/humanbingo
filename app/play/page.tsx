'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabase, checkBingo, DEFAULT_GAME_CODE, advanceToNextPrompt } from '@/lib/db';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { CountdownTimer } from '@/components/countdown-timer';
import { celebrateBingo } from '@/lib/confetti-utils';
import confetti from 'canvas-confetti';

interface Prompt {
  id: number;
  text: string;
}

interface CardMark {
  cell_index: number;
}

interface GameSession {
  id: number;
  code: string;
  status: string;
  current_prompt_index: number;
}

export default function PlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = searchParams.get('code') || DEFAULT_GAME_CODE;
  const isHost = searchParams.get('host') === 'true';

  const [session, setSession] = useState<GameSession | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(0);
  const [cardData, setCardData] = useState<number[]>([]);
  const [prompts, setPrompts] = useState<Map<number, Prompt>>(new Map());
  const [markedCells, setMarkedCells] = useState<Set<number>>(new Set());
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [hasBingo, setHasBingo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nextMessage, setNextMessage] = useState<string | null>(null);
  const [nextLoading, setNextLoading] = useState(false);
  const [confessionText, setConfessionText] = useState('');
  const [submittingConfession, setSubmittingConfession] = useState(false);
  const [refreshingCard, setRefreshingCard] = useState(false);

  // Load initial game data
  useEffect(() => {
    const loadGameData = async () => {
      try {
        // Get session
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', gameCode)
          .single();

        if (!sessionData) {
          router.push('/');
          return;
        }

        setSession(sessionData);

        // Get prompts
        const { data: promptsData } = await supabase
          .from('prompts')
          .select('*');

        if (promptsData) {
          const promptMap = new Map();
          promptsData.forEach((p: Prompt) => {
            promptMap.set(p.id, p);
          });
          setPrompts(promptMap);
        }

        // Get player data from sessionStorage
        const storedName = sessionStorage.getItem('playerName') || 'Player';
        const storedUserId = sessionStorage.getItem('userId') || '';
        setPlayerName(storedName);

        // Get player ID
        const { data: playerData } = await supabase
          .from('players')
          .select('id, cards(*)')
          .eq('user_id', storedUserId)
          .eq('session_id', sessionData.id)
          .single();

        if (playerData) {
          setPlayerId(playerData.id);
          if (playerData.cards && playerData.cards.length > 0) {
            setCardData(playerData.cards[0].card_data);
          }

          // Load marked cells
          const { data: marksData } = await supabase
            .from('card_marks')
            .select('cell_index')
            .eq('card_id', playerData.cards[0]?.id);

          if (marksData) {
            const marked = new Set(marksData.map((m: CardMark) => m.cell_index));
            // Always mark center cell as FREE
            marked.add(12);
            setMarkedCells(marked);
          }
        }

        // Get current prompt
        if (sessionData.current_prompt_index < sessionData.total_rounds) {
          const { data: roundData } = await supabase
            .from('rounds')
            .select('prompt_id, prompts(*)')
            .eq('session_id', sessionData.id)
            .eq('round_number', sessionData.current_prompt_index)
            .single();

          if (roundData && roundData.prompts) {
            setCurrentPrompt(roundData.prompts);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading game data:', err);
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameCode, router]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameCode || !playerId) return;

    // Subscribe to session updates (and refetch current prompt when round changes)
    const sessionSub = supabase
      .channel(`session:${gameCode}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `code=eq.${gameCode}`,
      }, async (payload: any) => {
        const newSession = payload.new;
        setSession(newSession);
        // Refetch current prompt when round advances
        if (newSession.current_prompt_index < newSession.total_rounds) {
          const { data: roundData } = await supabase
            .from('rounds')
            .select('prompt_id, prompts(*)')
            .eq('session_id', newSession.id)
            .eq('round_number', newSession.current_prompt_index)
            .single();
          if (roundData?.prompts) setCurrentPrompt(roundData.prompts);
        } else {
          setCurrentPrompt(null);
        }
      })
      .subscribe();

    // Subscribe to card marks
    const { data: playerData } = supabase
      .from('cards')
      .select('id')
      .eq('player_id', playerId);

    return () => {
      sessionSub.unsubscribe();
    };
  }, [gameCode, playerId]);

  const handleCellClick = async (index: number) => {
    if (index === 12) return; // Center is always free
    if (markedCells.has(index)) {
      // Unmark
      const newMarked = new Set(markedCells);
      newMarked.delete(index);
      setMarkedCells(newMarked);

      // Delete from database
      const { data: cardData } = await supabase
        .from('cards')
        .select('id')
        .eq('player_id', playerId)
        .single();

      if (cardData) {
        await supabase
          .from('card_marks')
          .delete()
          .eq('card_id', cardData.id)
          .eq('cell_index', index);
      }
    } else {
      // Mark
      const newMarked = new Set(markedCells);
      newMarked.add(index);
      setMarkedCells(newMarked);

      // Add to database
      const { data: cardData } = await supabase
        .from('cards')
        .select('id')
        .eq('player_id', playerId)
        .single();

      if (cardData) {
        await supabase
          .from('card_marks')
          .insert([
            {
              card_id: cardData.id,
              cell_index: index,
            },
          ]);
      }

      // Check for bingo
      if (checkBingo(newMarked)) {
        setHasBingo(true);
        playSound();
        celebrateBingo();
      }
    }
  };

  const handleSubmitConfession = async () => {
    if (!playerId || !confessionText.trim()) return;
    setSubmittingConfession(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ confession: confessionText.trim(), won: true })
        .eq('id', playerId);
      if (!error) {
        router.push(`/my-moments?code=${gameCode}`);
      }
    } finally {
      setSubmittingConfession(false);
    }
  };

  const handleRefreshUnmarkedSlots = async () => {
    if (!playerId || refreshingCard) return;
    setRefreshingCard(true);
    try {
      const { data: cardRow } = await supabase
        .from('cards')
        .select('id, card_data')
        .eq('player_id', playerId)
        .single();
      if (!cardRow?.card_data) {
        setRefreshingCard(false);
        return;
      }
      const currentCard = cardRow.card_data as number[];
      const keptIndices = new Set([...markedCells, 12]);
      const keptIds = new Set(currentCard.filter((_, i) => keptIndices.has(i)));
      const { data: allPrompts } = await supabase.from('prompts').select('id');
      if (!allPrompts?.length) {
        setRefreshingCard(false);
        return;
      }
      const allIds = allPrompts.map((p: { id: number }) => p.id);
      const availableIds = allIds.filter((id: number) => !keptIds.has(id));
      const shuffled = [...availableIds].sort(() => Math.random() - 0.5);
      let j = 0;
      const newCard = currentCard.map((id, i) => {
        if (keptIndices.has(i)) return id;
        if (i === 12) return id;
        return shuffled[j++] ?? id;
      });
      const { error } = await supabase
        .from('cards')
        .update({ card_data: newCard })
        .eq('id', cardRow.id);
      if (!error) setCardData(newCard);
    } finally {
      setRefreshingCard(false);
    }
  };

  const handleNextPrompt = async () => {
    if (!session || nextLoading) return;
    setNextLoading(true);
    setNextMessage(null);
    const advanced = await advanceToNextPrompt(
      session.id,
      session.current_prompt_index,
      session.total_rounds
    );
    setNextLoading(false);
    if (advanced) {
      setNextMessage('Explain to the group why you skipped! HAHAHA');
      setTimeout(() => setNextMessage(null), 5000);
    }
  };

  const playSound = () => {
    if (!soundEnabled) return;
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="text-lg">Loading game...</span>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-lg text-[var(--muted-foreground)]">Game not found</p>
          <Button onClick={() => router.push('/')} className="rounded-xl">Back Home</Button>
        </div>
      </main>
    );
  }

  const promptsArray = Array.from(prompts.values());

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 pb-10">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-64 bg-gradient-to-b from-[var(--accent)]/10 via-transparent to-transparent rounded-b-[50%]" />
      </div>

      {/* Header with logo */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl ios-card overflow-hidden flex items-center justify-center p-0.5">
              <Image src="/logo.png" alt="" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]" style={{ fontFamily: 'Fredoka One' }}>Human Bingo</h1>
              <p className="text-xs text-[var(--muted-foreground)]">Code: {session.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-xl border-[var(--border)]"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            {hasBingo && (
              <span className="px-3 py-1.5 bg-[var(--accent)]/20 text-[var(--accent)] font-bold rounded-xl text-sm">BINGO! — Say it out loud!</span>
            )}
          </div>
        </div>

        {/* Current Prompt - glass */}
        {currentPrompt && (
          <div className="glass-strong p-5 rounded-2xl mt-4">
            <p className="text-xs text-[var(--muted-foreground)] mb-1">Current prompt</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">{currentPrompt.text}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              Round {session.current_prompt_index + 1} of {session.total_rounds}
            </p>
            {nextMessage && (
              <p className="mt-3 py-2 px-3 bg-[var(--accent)]/15 rounded-xl text-[var(--accent)] font-medium text-center text-sm">
                {nextMessage}
              </p>
            )}
            <Button
              onClick={handleNextPrompt}
              disabled={nextLoading || session.current_prompt_index >= session.total_rounds - 1}
              variant="outline"
              className="w-full mt-4 rounded-xl border-[var(--border)]"
            >
              {nextLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "Next prompt — not on your card? Skip & explain to the group!"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Bingo Card */}
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-3">
          <Button
            onClick={handleRefreshUnmarkedSlots}
            disabled={refreshingCard}
            variant="outline"
            size="sm"
            className="rounded-xl border-[var(--border)]"
          >
            {refreshingCard ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Next bingo card (refresh unmarked slots)'
            )}
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-8">
          {cardData.map((promptId, index) => {
            const prompt = prompts.get(promptId);
            const isMarked = markedCells.has(index);
            const isFree = index === 12;

            return (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                disabled={isFree && !isHost}
                className={`aspect-square p-2 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer flex items-center justify-center text-center ${
                  isFree
                    ? 'bg-[var(--accent)]/30 border-2 border-[var(--accent)] text-[var(--accent)]'
                    : isMarked
                    ? 'bg-[var(--accent)] border-2 border-[var(--accent)] text-[var(--accent-foreground)] shadow-lg shadow-[var(--accent)]/25 scale-[0.98]'
                    : 'glass-secondary hover:bg-white/60 text-[var(--foreground)] active:scale-95'
                }`}
              >
                <span className="leading-tight line-clamp-4">
                  {isFree ? 'FREE' : prompt?.text || '?'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Game Controls */}
        {isHost && (
          <div className="glass-strong p-6 space-y-3 rounded-2xl">
            <Button
              onClick={() => router.push(`/dashboard?code=${gameCode}`)}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
            >
              View Host Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full h-12 rounded-xl border-[var(--border)]"
            >
              Exit Game
            </Button>
          </div>
        )}

        {hasBingo && (
          <div className="glass-strong p-6 rounded-2xl space-y-4 mb-8">
            <h2 className="text-2xl font-bold text-[var(--accent)]">🎉 BINGO! 🎉</h2>
            <p className="text-lg font-semibold text-[var(--foreground)]">Say BINGO out loud!</p>
            <p className="text-[var(--foreground)]">Congratulations {playerName}!</p>
            <p className="text-sm text-[var(--muted-foreground)]">Tell your confession — it will be saved and you’ll see your embarrassing moments list.</p>
            <textarea
              placeholder="What's your confession related to this game?"
              className="w-full p-4 rounded-xl bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              rows={3}
              value={confessionText}
              onChange={(e) => setConfessionText(e.target.value)}
            />
            <Button
              onClick={handleSubmitConfession}
              disabled={!confessionText.trim() || submittingConfession}
              className="w-full h-12 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
            >
              {submittingConfession ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Submit Confession'}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
