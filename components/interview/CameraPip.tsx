'use client';

import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';

interface CameraPipProps {
  stream: MediaStream | null;
}

export function CameraPip({ stream }: CameraPipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="flex h-[120px] w-[160px] items-center justify-center rounded-lg bg-muted">
        <VideoOff className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="h-[120px] w-[160px] rounded-lg object-cover shadow-lg"
      style={{ transform: 'scaleX(-1)' }}
    />
  );
}
