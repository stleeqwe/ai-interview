'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Avatar3D } from '@/components/interview/Avatar3D';
import { useInterviewStore } from '@/stores/interviewStore';

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

const AVATAR_OPTIONS: { label: string; path: string }[] = [
  { label: 'RPM (default)', path: '/models/rpm-avatar.glb' },
  { label: 'asanchezyali', path: '/models/avatar.glb' },
  { label: 'Sarah', path: '/models/avatar-sarah.glb' },
  { label: 'Doctor', path: '/models/avatar-doctor.glb' },
  { label: 'Nanami', path: '/models/avatar-nanami.glb' },
];

export default function TestAvatarPage() {
  const avatarState = useInterviewStore((s) => s.avatarState);
  const setAvatarState = useInterviewStore((s) => s.setAvatarState);
  const setInterviewSetup = useInterviewStore((s) => s.setInterviewSetup);
  const [selectedModel, setSelectedModel] = useState(AVATAR_OPTIONS[0].path);
  const mounted = useIsMounted();

  useEffect(() => {
    setInterviewSetup({
      company_analysis: {
        company_name: '테스트 회사',
        industry: '기술',
        position: '프론트엔드 개발자',
        key_requirements: ['React', 'TypeScript'],
        company_culture_keywords: ['혁신'],
      },
      candidate_analysis: {
        strengths: ['React 경험'],
        weaknesses: [],
        experience_level: '중급',
        key_experiences: ['웹 개발 3년'],
      },
      interviewers: [
        {
          name: '김면접',
          role: '기술 면접관',
          personality: '친근하고 전문적',
          focus_areas: ['프론트엔드'],
        },
      ],
      questions: [],
      system_prompt: '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }, [setInterviewSetup]);

  if (!mounted) return null;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* 풀스크린 3D 면접실 — key로 모델 변경 시 리마운트 */}
      <Avatar3D key={selectedModel} modelPath={selectedModel} />

      {/* 아바타 선택 */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {AVATAR_OPTIONS.map((opt) => (
          <button
            key={opt.path}
            onClick={() => setSelectedModel(opt.path)}
            className={`rounded-lg px-4 py-2 text-sm font-medium backdrop-blur transition-all text-left ${
              selectedModel === opt.path
                ? 'bg-white text-black shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 상태 전환 컨트롤 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {(['idle', 'speaking', 'listening'] as const).map((state) => (
          <button
            key={state}
            onClick={() => setAvatarState(state)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium backdrop-blur transition-all ${
              avatarState === state
                ? 'bg-white text-black shadow-lg'
                : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
            }`}
          >
            {state}
          </button>
        ))}
      </div>

      {/* 상태 표시 */}
      <div className="absolute top-4 left-4 z-20">
        <span className="rounded-full bg-black/40 backdrop-blur px-3 py-1.5 text-xs font-mono text-white/60">
          state: {avatarState}
        </span>
      </div>
    </div>
  );
}
