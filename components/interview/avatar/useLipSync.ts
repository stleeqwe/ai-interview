'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { LerpMorphTargetFn } from './types';
import { useInterviewStore } from '@/stores/interviewStore';
import { VISEMES } from './constants';

/** viseme별 jawOpen 가중치 */
const JAW_OPEN_MAP: Record<string, number> = {
  viseme_sil: 0,
  viseme_PP: 0.05,
  viseme_FF: 0.1,
  viseme_TH: 0.15,
  viseme_DD: 0.3,
  viseme_kk: 0.25,
  viseme_CH: 0.2,
  viseme_SS: 0.1,
  viseme_nn: 0.2,
  viseme_RR: 0.25,
  viseme_aa: 0.7,
  viseme_E: 0.4,
  viseme_I: 0.2,
  viseme_O: 0.5,
  viseme_U: 0.3,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LipsyncInstance = any;

/**
 * wawa-lipsync 기반 고정밀 립싱크
 * MFCC 오디오 분석 → Oculus/RPM 15개 viseme 매핑
 */
export function useLipSync() {
  const lipsyncRef = useRef<LipsyncInstance>(null);
  const connectedElRef = useRef<HTMLAudioElement | null>(null);
  const readyRef = useRef(false);

  // wawa-lipsync 동적 로드 (SSR 안전)
  useEffect(() => {
    let cancelled = false;

    import('wawa-lipsync').then((mod) => {
      if (cancelled) return;
      lipsyncRef.current = new mod.Lipsync();
      readyRef.current = true;

      // 이미 audioElement가 존재하면 즉시 연결
      const audioEl = useInterviewStore.getState().audioElement;
      if (audioEl && !connectedElRef.current) {
        try {
          lipsyncRef.current.connectAudio(audioEl);
          connectedElRef.current = audioEl;
        } catch (err) {
          console.warn('[LipSync] Audio connection failed:', err);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // audioElement 변경 구독
  useEffect(() => {
    const unsub = useInterviewStore.subscribe(
      (state) => state.audioElement,
      (audioEl) => {
        if (!audioEl) {
          connectedElRef.current = null;
          return;
        }
        if (!readyRef.current || !lipsyncRef.current) return;
        if (connectedElRef.current === audioEl) return;

        try {
          lipsyncRef.current.connectAudio(audioEl);
          connectedElRef.current = audioEl;
        } catch (err) {
          console.warn('[LipSync] Audio connection failed:', err);
        }
      },
      { fireImmediately: false }
    );

    return () => unsub();
  }, []);

  const update = useCallback((lerpMorphTarget: LerpMorphTargetFn) => {
    const lipsync = lipsyncRef.current;
    if (!lipsync || !readyRef.current) return;

    const avatarState = useInterviewStore.getState().avatarState;

    // 매 프레임 오디오 분석
    lipsync.processAudio();
    const activeViseme: string = lipsync.viseme ?? 'viseme_sil';

    // 모든 viseme morph target 업데이트 (부드러운 전환)
    const allVisemes = Object.values(VISEMES) as string[];
    for (const name of allVisemes) {
      const isActive = avatarState === 'speaking' && name === activeViseme;
      const target = isActive ? 1 : 0;
      const lerpSpeed = isActive ? 0.4 : 0.3;

      lerpMorphTarget(name, target, lerpSpeed);
    }

    // jawOpen — 활성 viseme에 비례하여 턱 벌림
    const jawTarget =
      avatarState === 'speaking' ? (JAW_OPEN_MAP[activeViseme] ?? 0) : 0;
    lerpMorphTarget('jawOpen', jawTarget, 0.35);
  }, []);

  return { update };
}
