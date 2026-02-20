import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { useInterviewStore } from '@/stores/interviewStore';
import { NOD, TRANSITION } from './constants';

interface AnimState {
  /** 현재 보간된 상태별 가중치 */
  listeningWeight: number;
  speakingWeight: number;
  /** 고개 끄덕임 */
  nextNodAt: number;
  nodProgress: number;
  isNodding: boolean;
  /** 경과 시간 */
  elapsed: number;
}

/**
 * 상태별 행동 조합: idle/speaking/listening
 */
export function useVrmAnimations() {
  const state = useRef<AnimState>({
    listeningWeight: 0,
    speakingWeight: 0,
    nextNodAt: randomBetween(NOD.MIN_INTERVAL, NOD.MAX_INTERVAL),
    nodProgress: 0,
    isNodding: false,
    elapsed: 0,
  });

  const update = useCallback((vrm: VRM, delta: number) => {
    const s = state.current;
    s.elapsed += delta;
    const t = s.elapsed;
    const avatarState = useInterviewStore.getState().avatarState;

    // --- 상태 가중치 부드러운 전환 ---
    const targetListening = avatarState === 'listening' ? 1 : 0;
    const targetSpeaking = avatarState === 'speaking' ? 1 : 0;

    s.listeningWeight = THREE.MathUtils.lerp(s.listeningWeight, targetListening, TRANSITION.LERP_FACTOR);
    s.speakingWeight = THREE.MathUtils.lerp(s.speakingWeight, targetSpeaking, TRANSITION.LERP_FACTOR);

    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const spine = vrm.humanoid?.getNormalizedBoneNode('spine');

    // --- Listening: 약간 앞으로 기움 + 주기적 끄덕임 ---
    if (spine) {
      // 앞으로 기울기 (listening 시)
      spine.rotation.x += s.listeningWeight * 0.03;
    }

    // 고개 끄덕임 (listening 상태에서만)
    if (avatarState === 'listening') {
      if (!s.isNodding && t >= s.nextNodAt) {
        s.isNodding = true;
        s.nodProgress = 0;
      }
      if (s.isNodding) {
        s.nodProgress += delta / NOD.DURATION;
        if (s.nodProgress >= 2) {
          s.isNodding = false;
          s.nodProgress = 0;
          s.nextNodAt = t + randomBetween(NOD.MIN_INTERVAL, NOD.MAX_INTERVAL);
        }
      }
    }

    const nodValue = s.isNodding
      ? Math.sin((s.nodProgress / 2) * Math.PI) * NOD.AMPLITUDE
      : 0;

    if (head) {
      head.rotation.x += nodValue * s.listeningWeight;
    }

    // --- Speaking: 더 활발한 머리 움직임 + 표정 변화 ---
    if (head) {
      const speakHeadX = Math.sin(t * 2.1) * 0.02 + Math.sin(t * 3.7) * 0.015;
      const speakHeadY = Math.sin(t * 1.8) * 0.025 + Math.sin(t * 2.9) * 0.01;
      head.rotation.x += speakHeadX * s.speakingWeight;
      head.rotation.y += speakHeadY * s.speakingWeight;
    }

    // Speaking 시 약간의 표정 변화
    vrm.expressionManager?.setValue('happy', s.speakingWeight * 0.1);
  }, []);

  return { update };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}
