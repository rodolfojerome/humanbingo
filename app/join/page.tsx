'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// No separate lobby or code entry—everyone joins from the landing page with the hardcoded game.
export default function JoinPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
