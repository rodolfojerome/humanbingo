import confetti from 'canvas-confetti';

export function celebrateWin() {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  const randomInRange = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  };

  const interval: any = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}

export function celebrateBingo() {
  // Center burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });

  // Left burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 50,
      origin: { x: 0.1, y: 0.6 },
    });
  }, 100);

  // Right burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 50,
      origin: { x: 0.9, y: 0.6 },
    });
  }, 200);
}

export function celebrateGameEnd() {
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;

  const interval: any = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    confetti({
      startVelocity: 45,
      spread: 180,
      ticks: 200,
      origin: { x: Math.random(), y: Math.random() - 0.2 },
      particleCount: 30,
      gravity: 0.8,
    });
  }, 250);
}
