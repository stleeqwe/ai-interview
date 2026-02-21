declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    showAvatar(
      avatar: { url: string; body?: string; lipsyncLang?: string; avatarMood?: string; [key: string]: unknown },
      onprogress?: ((url: string, event: ProgressEvent) => void) | null,
      onpreprocess?: ((gltf: unknown) => void) | null,
    ): Promise<void>;
    streamStart(
      opt?: Record<string, unknown>,
      onAudioStart?: (() => void) | null,
      onAudioEnd?: (() => void) | null,
      onSubtitles?: ((data: unknown) => void) | null,
      onMetrics?: ((data: unknown) => void) | null,
    ): Promise<void>;
    streamAudio(r: { audio: ArrayBuffer | Int16Array | Uint8Array | Float32Array; [key: string]: unknown }): void;
    streamNotifyEnd(): void;
    streamInterrupt(): void;
    streamStop(): void;
    setMood(mood: string): void;
    stop(): void;
    stopSpeaking(): void;
    setView(view: string, opt?: Record<string, unknown>): void;
    lookAtCamera(duration?: number): void;
  }
}
