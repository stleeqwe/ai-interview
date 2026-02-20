import { useEffect, useRef, useCallback } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';
import { LIP_SYNC } from './constants';

/** 이미 MediaElementSource로 연결된 요소 추적 (React Strict Mode 대응) */
const connectedElements = new WeakSet<HTMLAudioElement>();

interface AudioAnalyserResult {
  getFrequencyData: () => Uint8Array<ArrayBuffer> | null;
  getVolume: () => number;
}

/**
 * store의 audioElement를 구독하여 AudioContext + AnalyserNode 파이프라인 설정
 */
export function useAudioAnalyser(): AudioAnalyserResult {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    const unsub = useInterviewStore.subscribe(
      (state) => state.audioElement,
      (audioEl) => {
        // 이전 분석기 정리
        if (!audioEl) {
          analyserRef.current = null;
          dataArrayRef.current = null;
          return;
        }

        // 이미 연결된 요소는 재연결하지 않음
        if (connectedElements.has(audioEl)) {
          return;
        }

        try {
          const ctx = contextRef.current ?? new AudioContext();
          contextRef.current = ctx;

          const source = ctx.createMediaElementSource(audioEl);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = LIP_SYNC.FFT_SIZE;

          source.connect(analyser);
          analyser.connect(ctx.destination); // 스피커 출력 유지

          analyserRef.current = analyser;
          dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

          connectedElements.add(audioEl);
        } catch (err) {
          console.warn('오디오 분석기 설정 실패:', err);
        }
      },
      { fireImmediately: true }
    );

    return () => {
      unsub();
    };
  }, []);

  const getFrequencyData = useCallback((): Uint8Array<ArrayBuffer> | null => {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !dataArray) return null;

    analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  const getVolume = useCallback((): number => {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !dataArray) return 0;

    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }, []);

  return { getFrequencyData, getVolume };
}
