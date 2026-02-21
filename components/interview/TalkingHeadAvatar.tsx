'use client';

import { useEffect, useRef, useState } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';

interface TalkingHeadAvatarProps {
  modelPath?: string;
}

const MOOD_MAP: Record<string, string> = {
  idle: 'neutral',
  speaking: 'happy',
  listening: 'neutral',
};

export function TalkingHeadAvatar({ modelPath = '/models/rpm-avatar.glb' }: TalkingHeadAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headRef = useRef<any>(null);
  const streamStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 마운트: TalkingHead 인스턴스 생성 + 아바타 로드
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setError(null);
    setLoading(true);

    async function init() {
      // 컨테이너가 레이아웃을 갖을 때까지 대기
      if (container!.clientWidth === 0 || container!.clientHeight === 0) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      if (disposed) return;

      console.log('[TalkingHead] container size:', container!.clientWidth, container!.clientHeight);
      console.log('[TalkingHead] loading model:', modelPath);

      try {
        const { TalkingHead } = await import('@met4citizen/talkinghead');

        if (disposed) return;

        const head = new TalkingHead(container!, {
          ttsEndpoint: '',
          lipsyncModules: ['en'],
          lipsyncLang: 'en',
          cameraView: 'upper',
          modelFPS: 30,
          modelPixelRatio: window.devicePixelRatio,
          avatarMood: 'neutral',
          lightAmbientColor: 0xffffff,
          lightAmbientIntensity: 2,
          lightDirectColor: 0xaaaacc,
          lightDirectIntensity: 25,
          lightDirectPhi: 1,
          lightDirectTheta: 2,
          lightSpotIntensity: 0,
          cameraRotateEnable: false,
          cameraPanEnable: false,
          cameraZoomEnable: false,
        });

        if (disposed) return;

        headRef.current = head;

        console.log('[TalkingHead] instance created, loading avatar...');

        await head.showAvatar({
          url: modelPath,
          body: 'F',
          lipsyncLang: 'en',
          avatarMood: 'neutral',
        });

        if (disposed) return;

        console.log('[TalkingHead] avatar loaded, starting stream...');

        // 스트리밍 세션 시작 (OpenAI Realtime 24kHz PCM)
        await head.streamStart(
          {
            sampleRate: 24000,
            lipsyncLang: 'en',
          },
          () => {
            // onAudioStart
            useInterviewStore.getState().setAvatarState('speaking');
          },
          () => {
            // onAudioEnd
            useInterviewStore.getState().setAvatarState('listening');
          },
        );
        streamStartedRef.current = true;

        // store에 인스턴스 등록
        useInterviewStore.getState().setTalkingHeadRef(head);

        setLoading(false);
        console.log('[TalkingHead] avatar loaded and stream started');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[TalkingHead] avatar load failed:', msg, err);
        setError(msg);
        setLoading(false);
      }
    }

    init();

    return () => {
      disposed = true;
      const head = headRef.current;
      if (head) {
        try {
          if (streamStartedRef.current) {
            head.streamStop();
            streamStartedRef.current = false;
          }
          head.stopSpeaking();
          head.stop();
        } catch {
          // ignore cleanup errors
        }
      }
      headRef.current = null;
      useInterviewStore.getState().setTalkingHeadRef(null);
      // Three.js canvas 정리
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [modelPath]);

  // avatarState 변경 시 무드 전환
  useEffect(() => {
    const unsub = useInterviewStore.subscribe(
      (s) => s.avatarState,
      (avatarState) => {
        const head = headRef.current;
        if (!head) return;
        const mood = MOOD_MAP[avatarState] ?? 'neutral';
        try {
          head.setMood(mood);
        } catch {
          // mood 전환 실패 무시
        }
      },
    );
    return unsub;
  }, []);

  return (
    <div className="absolute inset-0">
      {/* 배경 이미지 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/office-bg.png)' }}
      />
      {/* TalkingHead 컨테이너 — Three.js canvas가 여기 생성됨 */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      />
      {/* 디버그: 에러 표시 */}
      {error && (
        <div className="absolute top-12 left-4 z-30 max-w-md rounded bg-red-900/80 px-3 py-2 text-xs text-red-200 font-mono whitespace-pre-wrap">
          Error: {error}
        </div>
      )}
      {loading && !error && (
        <div className="absolute top-12 left-4 z-30 rounded bg-black/60 px-3 py-2 text-xs text-white/60 font-mono">
          Loading avatar...
        </div>
      )}
    </div>
  );
}
