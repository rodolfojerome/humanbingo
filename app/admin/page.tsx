'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// No admin or lobby creation—everyone uses the single shared game.
export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
