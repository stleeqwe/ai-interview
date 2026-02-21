'use client';

import { useEffect } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';

const MIGRATION_KEYS = [
  'ai-interview-setup',
  'ai-interview-transcript',
  'ai-interview-evaluation',
  'ai-interview-resume-text',
  'ai-interview-grounding-report',
  'ai-interview-claude-metrics',
];

/** sessionStorage → localStorage 마이그레이션 (1회성) */
function migrateToLocalStorage() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('__migrated')) return;
  for (const key of MIGRATION_KEYS) {
    const val = sessionStorage.getItem(key);
    if (val && !localStorage.getItem(key)) {
      localStorage.setItem(key, val);
    }
  }
  localStorage.setItem('__migrated', '1');
}

export function StoreHydrator() {
  const hydrateFromSession = useInterviewStore((s) => s.hydrateFromSession);

  useEffect(() => {
    migrateToLocalStorage();
    hydrateFromSession();
  }, [hydrateFromSession]);

  return null;
}
