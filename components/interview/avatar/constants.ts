// 3D 아바타 애니메이션 설정 상수

export const BLINK = {
  /** 눈깜빡임 최소 간격 (초) */
  MIN_INTERVAL: 3,
  /** 눈깜빡임 최대 간격 (초) */
  MAX_INTERVAL: 7,
  /** 눈 감기/뜨기 지속 시간 (초) */
  DURATION: 0.15,
} as const;

export const BREATHING = {
  /** 호흡 주기 속도 (Hz) */
  FREQUENCY: 0.5,
  /** 가슴 뼈 Y축 진폭 (미터) */
  AMPLITUDE: 0.002,
} as const;

export const HEAD_SWAY = {
  /** X축 미세 흔들림 진폭 (라디안, ~2도) */
  AMPLITUDE_X: 0.035,
  /** Y축 미세 흔들림 진폭 (라디안, ~2도) */
  AMPLITUDE_Y: 0.035,
  /** 흔들림 속도 배율 */
  SPEED: 0.3,
} as const;

export const NOD = {
  /** 고개 끄덕임 최소 간격 (초) */
  MIN_INTERVAL: 3,
  /** 고개 끄덕임 최대 간격 (초) */
  MAX_INTERVAL: 5,
  /** 끄덕임 진폭 (라디안, ~3도) */
  AMPLITUDE: 0.052,
  /** 끄덕임 지속 시간 (초) */
  DURATION: 0.4,
} as const;

export const TRANSITION = {
  /** 상태 전환 lerp 계수 (프레임당) */
  LERP_FACTOR: 0.08,
} as const;

export const LIP_SYNC = {
  /** 주파수 밴드 경계 (Hz) */
  LOW_MIN: 100,
  LOW_MAX: 500,
  MID_MIN: 500,
  MID_MAX: 2000,
  HIGH_MIN: 2000,
  HIGH_MAX: 4000,
  /** 노이즈 플로어 임계값 (0-255 범위) */
  NOISE_FLOOR: 10,
  /** 블렌드쉐이프 보간 계수 */
  LERP_FACTOR: 0.3,
  /** FFT 크기 */
  FFT_SIZE: 256,
} as const;

export const CAMERA = {
  /** Field of view - 면접실 테이블 너머 면접관 시점 */
  FOV: 30,
  /** 카메라 위치: 테이블 건너편 지원자 시점 (살짝 위에서) */
  POSITION: [0, 1.35, 1.8] as const,
  /** 면접관 상반신 중심 */
  TARGET: [0, 1.3, 0] as const,
} as const;

/** 사무실 환경 설정 */
export const OFFICE = {
  /** 배경색 (따뜻한 사무실 톤) */
  BG_COLOR: '#2a2520',
  /** 바닥 Y 위치 */
  FLOOR_Y: 0,
  /** 책상 위치/크기 */
  DESK: {
    POSITION: [0, 0.72, 0.9] as const,
    SIZE: [1.4, 0.04, 0.7] as const,
    COLOR: '#5c3d2e',
  },
  /** 책상 다리 */
  DESK_LEG: {
    HEIGHT: 0.72,
    RADIUS: 0.025,
    COLOR: '#3d2b1f',
  },
} as const;
