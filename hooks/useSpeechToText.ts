'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

interface UseSpeechToTextReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function safeStopRecognition(ref: React.RefObject<SpeechRecognitionInstance | null>) {
  if (ref.current) {
    try { ref.current.stop(); } catch { /* ignore */ }
  }
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false); // BUG 5 fix: useState + useEffect for SSR safety
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // BUG 5 fix: Check SpeechRecognition support after mount (client-side only)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR에서 false로 초기화 후 클라이언트에서 실제 지원 여부 확인
    setIsSupported(!!getSpeechRecognitionClass());
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionClass();
    if (!SpeechRecognition) return;

    // 기존 인스턴스 정리
    safeStopRecognition(recognitionRef);

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: { error: string }) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    safeStopRecognition(recognitionRef);
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      safeStopRecognition(recognitionRef);
    };
  }, []);

  return { isListening, transcript, isSupported, startListening, stopListening, resetTranscript };
}
