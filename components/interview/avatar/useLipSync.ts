import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { useInterviewStore } from '@/stores/interviewStore';
import { LIP_SYNC } from './constants';
import { useAudioAnalyser } from './useAudioAnalyser';

interface LipValues {
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
}

/**
 * 오디오 주파수 데이터 → VRM 입 모양 블렌드쉐이프 매핑
 */
export function useLipSync() {
  const { getFrequencyData } = useAudioAnalyser();
  const currentValues = useRef<LipValues>({ aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });

  const update = useCallback((vrm: VRM) => {
    const avatarState = useInterviewStore.getState().avatarState;
    const data = getFrequencyData();
    const cv = currentValues.current;

    let targetAa = 0;
    let targetIh = 0;
    let targetOu = 0;
    let targetEe = 0;
    let targetOh = 0;

    if (data && avatarState === 'speaking') {
      const sampleRate = 48000; // WebRTC 기본 샘플레이트
      const binCount = data.length;
      const binWidth = sampleRate / 2 / binCount;

      // 주파수 밴드별 에너지 추출
      const low = getBandEnergy(data, binWidth, LIP_SYNC.LOW_MIN, LIP_SYNC.LOW_MAX);
      const mid = getBandEnergy(data, binWidth, LIP_SYNC.MID_MIN, LIP_SYNC.MID_MAX);
      const high = getBandEnergy(data, binWidth, LIP_SYNC.HIGH_MIN, LIP_SYNC.HIGH_MAX);

      // 노이즈 플로어 적용
      const nf = LIP_SYNC.NOISE_FLOOR / 255;
      const lowClean = Math.max(0, low - nf);
      const midClean = Math.max(0, mid - nf);
      const highClean = Math.max(0, high - nf);

      // 밴드별 → 입 모양 매핑
      targetAa = Math.min(1, lowClean * 2.5);   // 저주파 → 턱 벌림
      targetIh = Math.min(1, midClean * 2.0);    // 중주파 → 입 벌림
      targetEe = Math.min(1, midClean * 1.5);    // 중주파 → 입 벌림 (변형)
      targetOu = Math.min(1, highClean * 2.0);   // 고주파 → 입 동그라미
      targetOh = Math.min(1, highClean * 1.5);   // 고주파 → 입 동그라미 (변형)
    }

    // 부드러운 보간
    const lf = LIP_SYNC.LERP_FACTOR;
    cv.aa = THREE.MathUtils.lerp(cv.aa, targetAa, lf);
    cv.ih = THREE.MathUtils.lerp(cv.ih, targetIh, lf);
    cv.ou = THREE.MathUtils.lerp(cv.ou, targetOu, lf);
    cv.ee = THREE.MathUtils.lerp(cv.ee, targetEe, lf);
    cv.oh = THREE.MathUtils.lerp(cv.oh, targetOh, lf);

    // VRM 블렌드쉐이프 적용
    vrm.expressionManager?.setValue('aa', cv.aa);
    vrm.expressionManager?.setValue('ih', cv.ih);
    vrm.expressionManager?.setValue('ou', cv.ou);
    vrm.expressionManager?.setValue('ee', cv.ee);
    vrm.expressionManager?.setValue('oh', cv.oh);
  }, [getFrequencyData]);

  return { update };
}

/**
 * 지정 주파수 범위의 평균 에너지 (0-1)
 */
function getBandEnergy(
  data: Uint8Array<ArrayBufferLike>,
  binWidth: number,
  freqMin: number,
  freqMax: number
): number {
  const startBin = Math.floor(freqMin / binWidth);
  const endBin = Math.min(data.length - 1, Math.ceil(freqMax / binWidth));

  if (startBin >= endBin) return 0;

  let sum = 0;
  let count = 0;
  for (let i = startBin; i <= endBin; i++) {
    sum += data[i];
    count++;
  }

  return count > 0 ? sum / count / 255 : 0;
}
