'use client';

import { useEffect } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';

export function StoreHydrator() {
  const hydrateFromSession = useInterviewStore((s) => s.hydrateFromSession);

  useEffect(() => {
    hydrateFromSession();
  }, [hydrateFromSession]);

  return null;
}
