'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  duration: number; // in seconds
  onComplete?: () => void;
  autoStart?: boolean;
}

export function CountdownTimer({ duration, onComplete, autoStart = true }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onComplete]);

  const percentage = (timeLeft / duration) * 100;
  const isLow = timeLeft <= 5;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - percentage / 100)}`}
            className={`${isLow ? 'text-destructive' : 'text-accent'} transition-colors duration-300`}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${isLow ? 'text-destructive' : 'text-accent'}`}>
            {timeLeft}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={() => setIsRunning(false)}
            className="px-4 py-2 rounded-lg bg-secondary/20 text-foreground hover:bg-secondary/30 text-sm font-semibold"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={() => setIsRunning(true)}
            className="px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 text-sm font-semibold"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
