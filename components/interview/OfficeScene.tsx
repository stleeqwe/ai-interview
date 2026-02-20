'use client';

import { OFFICE } from './avatar/constants';

/**
 * 사무실 면접 환경: 바닥, 뒷벽, 책상 (경량)
 */
export function OfficeScene() {
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OFFICE.FLOOR_Y, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshLambertMaterial color="#3a3530" />
      </mesh>

      {/* 뒷벽 */}
      <mesh position={[0, 2.5, -2]}>
        <planeGeometry args={[10, 5]} />
        <meshLambertMaterial color="#4a4540" />
      </mesh>

      {/* 책상 상판 */}
      <mesh position={OFFICE.DESK.POSITION as unknown as [number, number, number]}>
        <boxGeometry args={OFFICE.DESK.SIZE as unknown as [number, number, number]} />
        <meshLambertMaterial color={OFFICE.DESK.COLOR} />
      </mesh>

      {/* 책상 다리 4개 */}
      {([
        [-0.6, 0.36, 0.65],
        [0.6, 0.36, 0.65],
        [-0.6, 0.36, 1.15],
        [0.6, 0.36, 1.15],
      ] as [number, number, number][]).map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.025, 0.025, 0.72, 6]} />
          <meshLambertMaterial color={OFFICE.DESK_LEG.COLOR} />
        </mesh>
      ))}

      {/* 서류 패드 */}
      <mesh position={[-0.3, 0.745, 0.85]} rotation={[-Math.PI / 2, 0, 0.05]}>
        <planeGeometry args={[0.22, 0.3]} />
        <meshLambertMaterial color="#f5f0e8" />
      </mesh>
    </group>
  );
}
