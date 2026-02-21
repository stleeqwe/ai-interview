/**
 * 모든 SkinnedMesh에 대해 모프타겟을 부드럽게 보간하는 함수 시그니처.
 * scene.traverse로 모든 메시를 순회하며 일괄 적용.
 */
export type LerpMorphTargetFn = (
  target: string,
  value: number,
  speed?: number
) => void;

/** 표정 프리셋: 모프타겟 이름 → 가중치 */
export type FacialExpression = Record<string, number>;
