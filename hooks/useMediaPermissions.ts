'use client';

import { useState, useCallback } from 'react';

interface MediaPermissions {
  microphone: PermissionState | null;
  camera: PermissionState | null;
}

interface UseMediaPermissionsReturn {
  permissions: MediaPermissions;
  micStream: MediaStream | null;
  camStream: MediaStream | null;
  micError: string | null;
  requestMicrophone: () => Promise<MediaStream | null>;
  requestCamera: () => Promise<MediaStream | null>;
  stopAllStreams: () => void;
}

export function useMediaPermissions(): UseMediaPermissionsReturn {
  const [permissions, setPermissions] = useState<MediaPermissions>({
    microphone: null,
    camera: null,
  });
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);

  const [micError, setMicError] = useState<string | null>(null);

  const requestMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setMicStream(stream);
      setPermissions((prev) => ({ ...prev, microphone: 'granted' }));
      return stream;
    } catch (err) {
      const error = err as DOMException;
      console.error('마이크 권한 요청 실패:', error.name, error.message);
      setMicError(`${error.name}: ${error.message}`);
      setPermissions((prev) => ({ ...prev, microphone: 'denied' }));
      return null;
    }
  }, []);

  const requestCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      setCamStream(stream);
      setPermissions((prev) => ({ ...prev, camera: 'granted' }));
      return stream;
    } catch {
      setPermissions((prev) => ({ ...prev, camera: 'denied' }));
      return null;
    }
  }, []);

  const stopAllStreams = useCallback(() => {
    micStream?.getTracks().forEach((t) => t.stop());
    camStream?.getTracks().forEach((t) => t.stop());
    setMicStream(null);
    setCamStream(null);
  }, [micStream, camStream]);

  return {
    permissions,
    micStream,
    camStream,
    micError,
    requestMicrophone,
    requestCamera,
    stopAllStreams,
  };
}
