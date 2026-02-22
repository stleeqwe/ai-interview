'use client';

import { useEffect } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';
import { cleanupOldSessions } from '@/lib/monitoring/db';

export function StoreHydrator() {
  const hydrateFromSession = useInterviewStore((s) => s.hydrateFromSession);

  useEffect(() => {
    hydrateFromSession();
    cleanupOldSessions();
  }, [hydrateFromSession]);

  return null;
}
