'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { joinGame } from '@/lib/join-game';
import { DEFAULT_GAME_CODE } from '@/lib/db';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await joinGame(DEFAULT_GAME_CODE, playerName.trim());
    setLoading(false);
    if (result.ok) {
      router.push(`/play?code=${result.code}`);
    } else {
      setError(result.error);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 pb-12 safe-area-padding">
      {/* Subtle gradient and soft glow (iPhone-style) */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-80 bg-gradient-to-b from-[var(--accent)]/12 via-transparent to-transparent rounded-b-[60%]" />
        <div className="absolute bottom-20 right-0 w-72 h-72 bg-[var(--primary)]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-0 w-64 h-64 bg-[var(--accent)]/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md mx-auto space-y-8 text-center">
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden ios-card flex items-center justify-center p-1.5 shrink-0">
            <Image
              src="/logo.png"
              alt="Human Bingo"
              width={72}
              height={72}
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight" style={{ fontFamily: 'Fredoka One' }}>
              Human Bingo
            </h1>
            <p className="text-[var(--muted-foreground)] text-sm">
              Mark off moments. First to BINGO wins.
            </p>
          </div>
        </div>

        {/* Join card - glassmorphism */}
        <form onSubmit={handlePlay} className="glass-strong p-6 space-y-5 rounded-2xl">
          <p className="text-[var(--foreground)]/90 text-sm">
            Enter your name. No code needed—everyone plays together.
          </p>
          <div className="space-y-2">
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={loading}
              className="h-12 rounded-xl bg-[var(--input)] border-[var(--border)] text-center text-base placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          {error && (
            <div className="py-3 px-4 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/30 text-[var(--destructive)] text-sm">
              {error}
            </div>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full h-14 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 text-lg font-semibold shadow-lg shadow-[var(--accent)]/25 border-0"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              'Play'
            )}
          </Button>
        </form>

        {/* Feature pills - iOS style */}
        <div className="glass-secondary grid grid-cols-3 gap-3 p-4 rounded-2xl">
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-2xl">🎮</span>
            <span className="text-xs font-medium text-[var(--foreground)]">Easy</span>
          </div>
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-2xl">👥</span>
            <span className="text-xs font-medium text-[var(--foreground)]">Shared</span>
          </div>
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-2xl">🎉</span>
            <span className="text-xs font-medium text-[var(--foreground)]">Fun</span>
          </div>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          For fun and laughter with friends
        </p>
      </div>
    </main>
  );
}
