// 3D 아바타 애니메이션 설정 상수

import type { FacialExpression } from './types';

export const BLINK = {
  MIN_INTERVAL: 3,
  MAX_INTERVAL: 7,
  DURATION: 0.15,
} as const;

export const BREATHING = {
  FREQUENCY: 0.5,
  AMPLITUDE: 0.002,
} as const;

export const HEAD_SWAY = {
  AMPLITUDE_X: 0.025,
  AMPLITUDE_Y: 0.025,
  SPEED: 0.3,
} as const;

export const NOD = {
  MIN_INTERVAL: 3,
  MAX_INTERVAL: 5,
  AMPLITUDE: 0.05,
  DURATION: 0.4,
} as const;

export const TRANSITION = {
  LERP_FACTOR: 0.08,
} as const;

export const CAMERA = {
  FOV: 28,
  /** 책상 건너편 지원자 시점 */
  POSITION: [0, 1.15, 2.0] as const,
  /** 면접관 얼굴~상체 중심 */
  TARGET: [0, 1.1, 0] as const,
} as const;

/** 사무실 환경 */
export const OFFICE = {
  BG_COLOR: '#1a1814',
  FLOOR_Y: 0,
  /** 의자에 앉은 모델의 Y 오프셋 */
  SEATED_Y: -0.55,
} as const;

/** RPM 모델(GLB)의 Mixamo 스켈레톤 뼈 이름 */
export const BONES = {
  HEAD: 'Head',
  NECK: 'Neck',
  SPINE: 'Spine',
  SPINE1: 'Spine1',
  SPINE2: 'Spine2',
  HIPS: 'Hips',
  LEFT_UP_LEG: 'LeftUpLeg',
  RIGHT_UP_LEG: 'RightUpLeg',
  LEFT_LEG: 'LeftLeg',
  RIGHT_LEG: 'RightLeg',
  LEFT_ARM: 'LeftArm',
  RIGHT_ARM: 'RightArm',
  LEFT_FOREARM: 'LeftForeArm',
  RIGHT_FOREARM: 'RightForeArm',
  LEFT_SHOULDER: 'LeftShoulder',
  RIGHT_SHOULDER: 'RightShoulder',
} as const;

/** ARKit viseme 이름 (RPM 모델) */
export const VISEMES = {
  SILENT: 'viseme_sil',
  AA: 'viseme_aa',
  E: 'viseme_E',
  I: 'viseme_I',
  O: 'viseme_O',
  U: 'viseme_U',
  CH: 'viseme_CH',
  DD: 'viseme_DD',
  FF: 'viseme_FF',
  KK: 'viseme_kk',
  NN: 'viseme_nn',
  PP: 'viseme_PP',
  RR: 'viseme_RR',
  SS: 'viseme_SS',
  TH: 'viseme_TH',
} as const;

/** ARKit 표정 이름 */
export const EXPRESSIONS = {
  BLINK_L: 'eyeBlinkLeft',
  BLINK_R: 'eyeBlinkRight',
  JAW_OPEN: 'jawOpen',
  MOUTH_SMILE_L: 'mouthSmileLeft',
  MOUTH_SMILE_R: 'mouthSmileRight',
  BROW_INNER_UP: 'browInnerUp',
} as const;

/** 면접 상황별 표정 프리셋 (avatarState → 모프타겟 가중치) */
export const FACIAL_EXPRESSIONS: Record<string, FacialExpression> = {
  default: {},
  smile: {
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    eyeSquintLeft: 0.2,
    eyeSquintRight: 0.2,
  },
  listening: {
    browInnerUp: 0.15,
    eyeWideLeft: 0.1,
    eyeWideRight: 0.1,
    mouthSmileLeft: 0.1,
    mouthSmileRight: 0.1,
  },
  thinking: {
    browInnerUp: 0.3,
    eyeSquintLeft: 0.15,
    eyeSquintRight: 0.15,
    mouthPressLeft: 0.2,
    mouthPressRight: 0.2,
  },
  concerned: {
    browInnerUp: 0.4,
    browOuterUpLeft: 0.2,
    browOuterUpRight: 0.2,
    mouthFrownLeft: 0.15,
    mouthFrownRight: 0.15,
  },
};

/** avatarState → 표정 프리셋 매핑 */
export const STATE_EXPRESSION_MAP: Record<string, string> = {
  idle: 'default',
  speaking: 'smile',
  listening: 'listening',
};

/** 68개 ARKit 모프타겟 전체 목록 (초기화 리셋용) */
export const ARKIT_MORPH_TARGETS = [
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
  'tongueOut',
  'viseme_sil',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
] as const;
