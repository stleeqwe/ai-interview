'use client';

import dynamic from 'next/dynamic';
import { useInterviewStore } from '@/stores/interviewStore';
import { Loader2, User } from 'lucide-react';
import { Component, type ReactNode, useState } from 'react';

const TalkingHeadAvatar = dynamic(
  () => import('./TalkingHeadAvatar').then((mod) => ({ default: mod.TalkingHeadAvatar })),
  {
    ssr: false,
    loading: () => <AvatarLoading />,
  }
);

function AvatarLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#2a2520]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
        <p className="text-sm text-white/40">면접실 준비 중...</p>
      </div>
    </div>
  );
}

/** WebGL 미지원 시 기존 2D 아바타 폴백 */
function Avatar2DFallback() {
  const avatarState = useInterviewStore((s) => s.avatarState);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
      <div
        className={`flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 transition-all duration-300 ${
          avatarState === 'speaking'
            ? 'ring-4 ring-primary/40 animate-pulse'
            : avatarState === 'listening'
              ? 'ring-2 ring-blue-400/40'
              : ''
        }`}
      >
        <User className="h-14 w-14 text-primary" />
      </div>
    </div>
  );
}

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * 풀스크린 3D 면접실 아바타.
 * 부모 요소의 전체 크기를 채움 (absolute inset-0).
 */
interface Avatar3DProps {
  modelPath?: string;
}

export function Avatar3D({ modelPath }: Avatar3DProps) {
  const [hasError, setHasError] = useState(false);
  const [webGLAvailable] = useState(() => isWebGLAvailable());

  return (
    <div className="absolute inset-0">
      {webGLAvailable && !hasError ? (
        <ErrorBoundaryWrapper onError={() => setHasError(true)}>
          <TalkingHeadAvatar modelPath={modelPath} />
        </ErrorBoundaryWrapper>
      ) : (
        <Avatar2DFallback />
      )}
    </div>
  );
}

class ErrorBoundaryWrapper extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
