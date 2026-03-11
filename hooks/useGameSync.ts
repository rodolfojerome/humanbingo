import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/db';

export function useGameSync(gameCode: string | null, onSessionUpdate?: (session: any) => void, onPlayersUpdate?: (players: any[]) => void) {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!gameCode) return;

    // Subscribe to session changes
    const channel = supabase.channel(`game:${gameCode}`);

    // Listen for session updates
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `code=eq.${gameCode}`,
      },
      (payload) => {
        onSessionUpdate?.(payload.new);
      }
    );

    // Listen for player updates
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
      },
      async () => {
        // Refetch players
        const { data: session } = await supabase
          .from('sessions')
          .select('id')
          .eq('code', gameCode)
          .single();

        if (session) {
          const { data: players } = await supabase
            .from('players')
            .select('*')
            .eq('session_id', session.id);

          onPlayersUpdate?.(players || []);
        }
      }
    );

    // Listen for card marks updates
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'card_marks',
      },
      (payload) => {
        // Could trigger a refresh of game state here
      }
    );

    // Listen for rounds updates
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rounds',
      },
      (payload) => {
        // New prompt available
      }
    );

    channel.subscribe();

    unsubscribeRef.current = () => {
      channel.unsubscribe();
    };

    return () => {
      unsubscribeRef.current?.();
    };
  }, [gameCode, onSessionUpdate, onPlayersUpdate]);

  return unsubscribeRef.current;
}
