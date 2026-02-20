'use client';

import { useRef, useCallback, useState } from 'react';
import { useInterviewStore } from '@/stores/interviewStore';

type SessionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseRealtimeSessionReturn {
  status: SessionStatus;
  connect: (clientSecret: string, micStream: MediaStream) => Promise<void>;
  disconnect: () => void;
  sendTextEvent: (text: string) => void;
}

const SDP_URL = 'https://api.openai.com/v1/realtime/calls';
const REALTIME_MODEL = 'gpt-realtime';

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const connectingRef = useRef(false);

  const connect = useCallback(
    async (clientSecret: string, micStream: MediaStream) => {
      // React Strict Mode 이중 호출 방지
      if (connectingRef.current) return;
      connectingRef.current = true;

      // 기존 연결 정리
      cleanup();
      setStatus('connecting');

      try {
        // 1. RTCPeerConnection 생성
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 2. 오디오 출력 엘리먼트 연결 (DOM에 추가해야 일부 브라우저에서 재생됨)
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        audioElRef.current = audioEl;
        useInterviewStore.getState().setAudioElement(audioEl);

        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
        };

        // 3. 마이크 트랙 추가
        micStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, micStream);
        });

        // 4. DataChannel 생성 (서버 이벤트 수신용)
        const dc = pc.createDataChannel('oai-events');
        dcRef.current = dc;

        dc.onopen = () => {
          setStatus('connected');
          useInterviewStore.getState().setInterviewActive(true);
        };

        dc.onclose = () => {
          setStatus('disconnected');
          useInterviewStore.getState().setInterviewActive(false);
        };

        dc.onmessage = (e) => {
          try {
            handleServerEvent(JSON.parse(e.data));
          } catch (err) {
            console.warn('DataChannel 메시지 파싱 실패:', err);
          }
        };

        // 5. SDP Offer 생성
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 6. OpenAI Realtime API에 SDP 전송 (/v1/realtime/calls 엔드포인트)
        const sdpResponse = await fetch(`${SDP_URL}?model=${REALTIME_MODEL}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        });

        if (!sdpResponse.ok) {
          const errorText = await sdpResponse.text().catch(() => '');
          throw new Error(`SDP exchange failed: ${sdpResponse.status} ${errorText}`);
        }

        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (error) {
        console.error('WebRTC 연결 실패:', error);
        setStatus('error');
        connectingRef.current = false;
        cleanup();
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    connectingRef.current = false;
    cleanup();
    setStatus('disconnected');
    useInterviewStore.getState().setInterviewActive(false);
  }, []);

  const sendTextEvent = useCallback((text: string) => {
    if (dcRef.current?.readyState === 'open') {
      // 시스템 토큰을 사용자 입력에서 제거 (인젝션 방지)
      const sanitized = text.replace(/\[INTERVIEW_END\]/g, '');
      // conversation.item.create 이벤트 형식으로 전송
      dcRef.current.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: sanitized }],
          },
        })
      );
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

  function cleanup() {
    dcRef.current?.close();
    dcRef.current = null;

    // PeerConnection sender 트랙 정리
    pcRef.current?.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    pcRef.current?.close();
    pcRef.current = null;

    if (audioElRef.current) {
      useInterviewStore.getState().setAudioElement(null);
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
  }

  function handleServerEvent(event: Record<string, unknown>) {
    const store = useInterviewStore.getState();
    const type = event.type as string;

    switch (type) {
      case 'response.audio_transcript.done': {
        const transcript = (event as { transcript?: string }).transcript;
        if (transcript) {
          // [INTERVIEW_END] 토큰을 표시 텍스트에서 제거
          const cleanTranscript = transcript.replace(/\[INTERVIEW_END\]/g, '').trim();
          if (cleanTranscript) {
            store.addTranscript({
              speaker: 'interviewer',
              text: cleanTranscript,
              timestamp: Date.now(),
            });
          }

          // [INTERVIEW_END] 토큰 감지 — 면접관(AI) 발화에서만 감지
          if (transcript.includes('[INTERVIEW_END]')) {
            setTimeout(() => disconnect(), 2000);
          }
        }
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const userTranscript = (event as { transcript?: string }).transcript;
        if (userTranscript) {
          store.addTranscript({
            speaker: 'candidate',
            text: userTranscript,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'response.audio.delta': {
        store.setAvatarState('speaking');
        break;
      }

      case 'response.audio.done': {
        store.setAvatarState('listening');
        break;
      }

      case 'input_audio_buffer.speech_started': {
        store.setAvatarState('listening');
        break;
      }

      case 'session.created': {
        console.log('Realtime 세션 생성됨');
        break;
      }

      case 'error': {
        console.error('Realtime API error:', event);
        break;
      }
    }
  }

  return { status, connect, disconnect, sendTextEvent };
}
