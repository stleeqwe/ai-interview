'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, SkeletonUtils } from 'three-stdlib';
import { useLipSync } from './avatar/useLipSync';
import { useInterviewStore } from '@/stores/interviewStore';
import { OFFICE, EXPRESSIONS, BLINK } from './avatar/constants';

const MODEL_PATH = '/models/interviewer.glb';
const ANIMATIONS_PATH = '/models/animations.glb';

export interface MorphTargetRef {
  mesh: THREE.SkinnedMesh;
  dict: Record<string, number>;
}

/** avatarState → 재생할 애니메이션 */
const STATE_ANIMS: Record<string, string[]> = {
  idle: ['Idle'],
  speaking: ['TalkingOne', 'TalkingTwo', 'TalkingThree'],
  listening: ['HappyIdle'],
};

export function Avatar3DModel() {
  const gltf = useLoader(GLTFLoader, MODEL_PATH);
  const animGltf = useLoader(GLTFLoader, ANIMATIONS_PATH);

  const groupRef = useRef<THREE.Group>(null);
  const morphRef = useRef<MorphTargetRef | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const currentClipRef = useRef<string>('Idle');

  const lipSync = useLipSync();

  // 눈 깜빡임 상태
  const blinkRef = useRef({
    nextAt: BLINK.MIN_INTERVAL + Math.random() * (BLINK.MAX_INTERVAL - BLINK.MIN_INTERVAL),
    progress: 0,
    isBlinking: false,
    elapsed: 0,
  });

  // 모델 클론 + morph 탐색
  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene);

    // viseme morph target이 있는 SkinnedMesh 찾기
    cloned.traverse((child) => {
      if (
        child instanceof THREE.SkinnedMesh &&
        child.morphTargetDictionary &&
        child.morphTargetInfluences &&
        'viseme_aa' in child.morphTargetDictionary
      ) {
        morphRef.current = {
          mesh: child,
          dict: child.morphTargetDictionary,
        };
      }
    });

    return cloned;
  }, [gltf]);

  // AnimationMixer — groupRef에 바인딩
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const mixer = new THREE.AnimationMixer(group);
    mixerRef.current = mixer;

    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of animGltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      actions[clip.name] = action;
    }
    actionsRef.current = actions;

    // Idle 시작
    if (actions['Idle']) {
      actions['Idle'].play();
      currentClipRef.current = 'Idle';
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(group);
    };
  }, [animGltf, clonedScene]);

  // avatarState 변경 → 애니메이션 크로스페이드
  useEffect(() => {
    const unsub = useInterviewStore.subscribe(
      (state) => state.avatarState,
      (avatarState) => {
        const actions = actionsRef.current;
        const candidates = STATE_ANIMS[avatarState] ?? ['Idle'];
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
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
  }, []);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);

    const morph = morphRef.current;
    if (!morph) return;

    // ── 눈 깜빡임 ──
    const b = blinkRef.current;
    b.elapsed += delta;
    if (!b.isBlinking && b.elapsed >= b.nextAt) {
      b.isBlinking = true;
      b.progress = 0;
    }
    if (b.isBlinking) {
      b.progress += delta / BLINK.DURATION;
      if (b.progress >= 2) {
        b.isBlinking = false;
        b.progress = 0;
        b.nextAt = b.elapsed + BLINK.MIN_INTERVAL + Math.random() * (BLINK.MAX_INTERVAL - BLINK.MIN_INTERVAL);
      }
    }
    const blinkVal = b.isBlinking
      ? (b.progress <= 1 ? b.progress : 2 - b.progress)
      : 0;
    setMorph(morph, EXPRESSIONS.BLINK_L, blinkVal);
    setMorph(morph, EXPRESSIONS.BLINK_R, blinkVal);

    // ── 립싱크 ──
    lipSync.update(morph);
  });

  return (
    <group ref={groupRef} position={[0, OFFICE.SEATED_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function setMorph(morph: MorphTargetRef, name: string, value: number) {
  const idx = morph.dict[name];
  if (idx !== undefined && morph.mesh.morphTargetInfluences) {
    morph.mesh.morphTargetInfluences[idx] = value;
  }
}
