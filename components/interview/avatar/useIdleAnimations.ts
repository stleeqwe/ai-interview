import { useRef, useCallback } from 'react';
import type { VRM } from '@pixiv/three-vrm';
import { BLINK, BREATHING, HEAD_SWAY } from './constants';

interface BlinkState {
  nextBlinkAt: number;
  blinkProgress: number; // 0 = open, 1 = closed
  isBlinking: boolean;
}

/**
 * 모든 상태에서 기본 동작: 호흡, 눈깜빡임, 머리 미세 흔들림
 */
export function useIdleAnimations() {
  const elapsed = useRef(0);
  const blinkState = useRef<BlinkState>({
    nextBlinkAt: randomBetween(BLINK.MIN_INTERVAL, BLINK.MAX_INTERVAL),
    blinkProgress: 0,
    isBlinking: false,
  });

  const update = useCallback((vrm: VRM, delta: number) => {
    elapsed.current += delta;
    const t = elapsed.current;

    // --- 호흡: 가슴(spine) 뼈 Y축 오실레이션 ---
    const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
    if (spine) {
      spine.position.y += Math.sin(t * Math.PI * 2 * BREATHING.FREQUENCY) * BREATHING.AMPLITUDE;
    }

    // --- 눈깜빡임 ---
    const blink = blinkState.current;
    if (!blink.isBlinking && t >= blink.nextBlinkAt) {
      blink.isBlinking = true;
      blink.blinkProgress = 0;
    }

    if (blink.isBlinking) {
      blink.blinkProgress += delta / BLINK.DURATION;
      if (blink.blinkProgress >= 2) {
        // 감았다 뜸 (0→1→0 사이클)
        blink.isBlinking = false;
        blink.blinkProgress = 0;
        blink.nextBlinkAt = t + randomBetween(BLINK.MIN_INTERVAL, BLINK.MAX_INTERVAL);
      }
    }

    const blinkValue = blink.isBlinking
      ? (blink.blinkProgress <= 1 ? blink.blinkProgress : 2 - blink.blinkProgress)
      : 0;

    vrm.expressionManager?.setValue('blink', blinkValue);

    // --- 머리 미세 흔들림: 복합 sine파 ---
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    if (head) {
      const swayX =
        Math.sin(t * HEAD_SWAY.SPEED * 1.7) * HEAD_SWAY.AMPLITUDE_X * 0.6 +
        Math.sin(t * HEAD_SWAY.SPEED * 0.7) * HEAD_SWAY.AMPLITUDE_X * 0.4;
      const swayY =
        Math.sin(t * HEAD_SWAY.SPEED * 1.3) * HEAD_SWAY.AMPLITUDE_Y * 0.5 +
        Math.sin(t * HEAD_SWAY.SPEED * 0.5) * HEAD_SWAY.AMPLITUDE_Y * 0.5;

      head.rotation.x += swayX;
      head.rotation.y += swayY;
    }
  }, []);

  return { update };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}
