'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader, SkeletonUtils } from 'three-stdlib';
import { useInterviewStore } from '@/stores/interviewStore';
import {
  OFFICE,
  EXPRESSIONS,
  BLINK,
  ARKIT_MORPH_TARGETS,
  FACIAL_EXPRESSIONS,
  STATE_EXPRESSION_MAP,
} from './avatar/constants';
import type { LerpMorphTargetFn } from './avatar/types';

const DEFAULT_MODEL_PATH = '/models/avatar.glb';
const ANIMATIONS_PATH = '/models/avatar-animations.glb';

/** avatarState → 재생할 애니메이션 */
const STATE_ANIMS: Record<string, string[]> = {
  idle: ['Idle'],
  speaking: ['TalkingOne', 'TalkingTwo', 'TalkingThree'],
  listening: ['HappyIdle'],
};

interface Avatar3DModelProps {
  modelPath?: string;
}

export function Avatar3DModel({ modelPath = DEFAULT_MODEL_PATH }: Avatar3DModelProps) {
  const gltf = useLoader(GLTFLoader, modelPath);
  const animGltf = useLoader(GLTFLoader, ANIMATIONS_PATH);

  const groupRef = useRef<THREE.Group>(null);
  const currentClipRef = useRef<string>('Idle');

  // 눈 깜빡임: useRef + setTimeout 방식
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBlinkingRef = useRef(false);

  // 모델 클론
  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene);
    return cloned;
  }, [gltf]);

  // drei useAnimations — 자동으로 mixer 업데이트 처리
  const { actions } = useAnimations(animGltf.animations, groupRef);

  // ── 마운트 시 모든 모프타겟을 0으로 초기화 (눈 돌출 방지) ──
  useEffect(() => {
    if (!clonedScene) return;

    clonedScene.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        child.morphTargetDictionary &&
        child.morphTargetInfluences
      ) {
        for (const target of ARKIT_MORPH_TARGETS) {
          const idx = child.morphTargetDictionary[target];
          if (idx !== undefined) {
            child.morphTargetInfluences[idx] = 0;
          }
        }
      }
    });
  }, [clonedScene]);

  // ── lerpMorphTarget: 모든 SkinnedMesh를 일괄 제어 ──
  const lerpMorphTarget: LerpMorphTargetFn = useCallback(
    (target: string, value: number, speed = 0.1) => {
      clonedScene.traverse((child) => {
        if (
          child instanceof THREE.SkinnedMesh &&
          child.morphTargetDictionary &&
          child.morphTargetInfluences
        ) {
          const idx = child.morphTargetDictionary[target];
          if (idx !== undefined) {
            child.morphTargetInfluences[idx] = THREE.MathUtils.lerp(
              child.morphTargetInfluences[idx],
              value,
              speed
            );
          }
        }
      });
    },
    [clonedScene]
  );

  // ── Idle 애니메이션 시작 ──
  useEffect(() => {
    if (actions['Idle']) {
      actions['Idle'].reset().setEffectiveWeight(1).fadeIn(0.5).play();
      currentClipRef.current = 'Idle';
    }
  }, [actions]);

  // ── avatarState 변경 → 애니메이션 크로스페이드 ──
  useEffect(() => {
    const unsub = useInterviewStore.subscribe(
      (state) => state.avatarState,
      (avatarState) => {
        const candidates = STATE_ANIMS[avatarState] ?? ['Idle'];
        const pick =
          candidates[Math.floor(Math.random() * candidates.length)];
        if (pick === currentClipRef.current) return;

        const next = actions[pick];
        const prev = actions[currentClipRef.current];
        if (!next) return;

        next.reset().setEffectiveWeight(1).fadeIn(0.5).play();
        prev?.fadeOut(0.5);
        currentClipRef.current = pick;
      },
      { fireImmediately: false }
    );
    return () => unsub();
  }, [actions]);

  // ── 눈 깜빡임: setTimeout 기반 (1~5초 랜덤 간격, 200ms 지속) ──
  useEffect(() => {
    function scheduleBlink() {
      const interval =
        BLINK.MIN_INTERVAL * 1000 +
        Math.random() * (BLINK.MAX_INTERVAL - BLINK.MIN_INTERVAL) * 1000;

      blinkTimeoutRef.current = setTimeout(() => {
        isBlinkingRef.current = true;

        // 200ms 후 눈 뜨기
        blinkTimeoutRef.current = setTimeout(() => {
          isBlinkingRef.current = false;
          scheduleBlink();
        }, 200);
      }, interval);
    }

    scheduleBlink();
    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, []);

  // ── 매 프레임 업데이트 ──
  useFrame(() => {
    // 눈 깜빡임 — 모든 메시에 적용
    const blinkValue = isBlinkingRef.current ? 1 : 0;
    lerpMorphTarget(EXPRESSIONS.BLINK_L, blinkValue, 0.5);
    lerpMorphTarget(EXPRESSIONS.BLINK_R, blinkValue, 0.5);

    // 표정 프리셋 적용
    const avatarState = useInterviewStore.getState().avatarState;
    const expressionKey = STATE_EXPRESSION_MAP[avatarState] ?? 'default';
    const expression = FACIAL_EXPRESSIONS[expressionKey] ?? {};

    // 표정 프리셋에 포함된 모프타겟만 부드럽게 적용
    // (깜빡임은 제외 — 별도 시스템에서 제어)
    for (const [target, value] of Object.entries(expression)) {
      if (
        target === EXPRESSIONS.BLINK_L ||
        target === EXPRESSIONS.BLINK_R
      ) {
        continue;
      }
      lerpMorphTarget(target, value, 0.1);
    }

    // 간단한 턱 애니메이션 (speaking 상태에서만)
    const jawTarget = avatarState === 'speaking'
      ? 0.3 + Math.sin(Date.now() * 0.008) * 0.2
      : 0;
    lerpMorphTarget(EXPRESSIONS.JAW_OPEN, jawTarget, 0.3);
  });

  return (
    <group ref={groupRef} position={[0, OFFICE.SEATED_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}
