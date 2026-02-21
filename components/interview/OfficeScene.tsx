'use client';

/**
 * 사실적인 사무실 면접 환경
 * - 바닥(나무), 벽면, 천장
 * - 면접 책상 + 사무용 의자
 * - 창문 (밝은 빛)
 * - 캐비닛, 화분, 벽 액자, 시계
 * - 천장 조명 패널
 */
export function OfficeScene() {
  return (
    <group>
      {/* ===== 바닥: 나무 패턴 시뮬레이션 ===== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* ===== 벽면 ===== */}
      {/* 뒷벽 */}
      <mesh position={[0, 1.5, -1.5]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.9} />
      </mesh>
      {/* 왼쪽 벽 */}
      <mesh position={[-3, 1.5, 1.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="#ddd5c8" roughness={0.9} />
      </mesh>
      {/* 오른쪽 벽 */}
      <mesh position={[3, 1.5, 1.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color="#ddd5c8" roughness={0.9} />
      </mesh>

      {/* ===== 천장 ===== */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3, 1.5]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#f0ece4" roughness={0.95} />
      </mesh>

      {/* 천장 조명 패널 */}
      <mesh position={[0, 2.95, 0.5]}>
        <boxGeometry args={[1.2, 0.03, 0.6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-1.8, 2.95, 0.5]}>
        <boxGeometry args={[0.8, 0.03, 0.4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>

      {/* ===== 창문 (왼쪽 벽) ===== */}
      <group position={[-2.98, 1.6, 0]}>
        {/* 창문 프레임 */}
        <mesh>
          <boxGeometry args={[0.04, 1.4, 1.2]} />
          <meshStandardMaterial color="#888580" metalness={0.3} roughness={0.5} />
        </mesh>
        {/* 유리 (밝은 빛) */}
        <mesh position={[0.01, 0, 0]}>
          <planeGeometry args={[0.02, 1.3, 1.1]} />
          <meshStandardMaterial
            color="#c4dff6"
            emissive="#87CEEB"
            emissiveIntensity={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
        {/* 창문 프레임 가로 분할 */}
        <mesh>
          <boxGeometry args={[0.05, 0.03, 1.2]} />
          <meshStandardMaterial color="#888580" metalness={0.3} roughness={0.5} />
        </mesh>
        {/* 창문 프레임 세로 분할 */}
        <mesh>
          <boxGeometry args={[0.05, 1.4, 0.03]} />
          <meshStandardMaterial color="#888580" metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
      {/* 창문에서 들어오는 빛 */}
      <directionalLight position={[-3, 2, 0]} intensity={0.6} color="#ffeebb" />

      {/* ===== 면접 책상 ===== */}
      {/* 상판 */}
      <mesh position={[0, 0.73, 0.85]}>
        <boxGeometry args={[1.6, 0.04, 0.75]} />
        <meshStandardMaterial color="#6B4226" roughness={0.5} metalness={0.05} />
      </mesh>
      {/* 상판 앞쪽 두께감 */}
      <mesh position={[0, 0.71, 1.22]}>
        <boxGeometry args={[1.6, 0.06, 0.02]} />
        <meshStandardMaterial color="#5a3720" roughness={0.5} />
      </mesh>
      {/* 책상 다리 패널 (양쪽) */}
      <mesh position={[-0.7, 0.365, 0.85]}>
        <boxGeometry args={[0.04, 0.73, 0.7]} />
        <meshStandardMaterial color="#5a3720" roughness={0.6} />
      </mesh>
      <mesh position={[0.7, 0.365, 0.85]}>
        <boxGeometry args={[0.04, 0.73, 0.7]} />
        <meshStandardMaterial color="#5a3720" roughness={0.6} />
      </mesh>
      {/* 뒷판 */}
      <mesh position={[0, 0.365, 0.51]}>
        <boxGeometry args={[1.36, 0.73, 0.02]} />
        <meshStandardMaterial color="#4d301a" roughness={0.7} />
      </mesh>

      {/* ===== 면접관 의자 ===== */}
      <OfficeChair position={[0, 0, -0.15]} />

      {/* ===== 책상 위 소품 ===== */}
      {/* 서류 묶음 */}
      <mesh position={[-0.35, 0.755, 0.9]} rotation={[-Math.PI / 2, 0, 0.08]}>
        <boxGeometry args={[0.21, 0.29, 0.012]} />
        <meshStandardMaterial color="#f8f5ef" roughness={0.95} />
      </mesh>
      {/* 펜 */}
      <mesh position={[-0.15, 0.755, 0.92]} rotation={[0, 0.15, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.004, 0.14, 6]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* 명함꽂이 */}
      <mesh position={[0.45, 0.77, 0.75]}>
        <boxGeometry args={[0.1, 0.04, 0.06]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* 물컵 */}
      <mesh position={[0.5, 0.79, 0.95]}>
        <cylinderGeometry args={[0.03, 0.025, 0.09, 12]} />
        <meshStandardMaterial
          color="#e0eeff"
          roughness={0.1}
          metalness={0.05}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* ===== 뒷벽 장식 ===== */}
      {/* 액자 1 */}
      <group position={[-0.8, 1.8, -1.48]}>
        <mesh>
          <boxGeometry args={[0.5, 0.4, 0.02]} />
          <meshStandardMaterial color="#3d3530" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.011]}>
          <planeGeometry args={[0.42, 0.32]} />
          <meshStandardMaterial color="#c8b8a0" roughness={0.8} />
        </mesh>
      </group>
      {/* 액자 2 */}
      <group position={[0.6, 1.9, -1.48]}>
        <mesh>
          <boxGeometry args={[0.6, 0.35, 0.02]} />
          <meshStandardMaterial color="#2c2520" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.011]}>
          <planeGeometry args={[0.52, 0.27]} />
          <meshStandardMaterial color="#a0b0a0" roughness={0.8} />
        </mesh>
      </group>

      {/* ===== 캐비닛 (오른쪽 벽) ===== */}
      <mesh position={[2.5, 0.5, -0.5]}>
        <boxGeometry args={[0.5, 1.0, 0.4]} />
        <meshStandardMaterial color="#7a6050" roughness={0.6} />
      </mesh>
      <mesh position={[2.5, 1.1, -0.5]}>
        <boxGeometry args={[0.5, 0.02, 0.4]} />
        <meshStandardMaterial color="#6a5040" roughness={0.5} />
      </mesh>
      {/* 캐비닛 위 화분 */}
      <group position={[2.5, 1.15, -0.5]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.06, 0.12, 8]} />
          <meshStandardMaterial color="#b87333" roughness={0.7} />
        </mesh>
        {/* 식물 (간단한 구체) */}
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#3a6b35" roughness={0.9} />
        </mesh>
      </group>

      {/* ===== 바닥 걸레받이 ===== */}
      <mesh position={[0, 0.04, -1.49]}>
        <boxGeometry args={[8, 0.08, 0.02]} />
        <meshStandardMaterial color="#ddd5c8" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** 사무용 의자 (간단한 기하학적 형태) */
function OfficeChair({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* 좌석 */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.45, 0.06, 0.42]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>
      {/* 등받이 */}
      <mesh position={[0, 0.75, -0.18]}>
        <boxGeometry args={[0.43, 0.55, 0.04]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </mesh>
      {/* 중심 기둥 */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* 바퀴 베이스 (별형) */}
      {[0, 1.26, 2.51, 3.77, 5.03].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.sin(angle) * 0.22, 0.04, Math.cos(angle) * 0.22]}
          rotation={[Math.PI / 2, 0, angle]}
        >
          <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
          <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* 바퀴 */}
      {[0, 1.26, 2.51, 3.77, 5.03].map((angle, i) => (
        <mesh
          key={`w${i}`}
          position={[Math.sin(angle) * 0.22, 0.02, Math.cos(angle) * 0.22]}
        >
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#333" roughness={0.5} />
        </mesh>
      ))}
      {/* 팔걸이 */}
      <mesh position={[-0.24, 0.6, 0.02]}>
        <boxGeometry args={[0.04, 0.04, 0.25]} />
        <meshStandardMaterial color="#333" roughness={0.7} />
      </mesh>
      <mesh position={[0.24, 0.6, 0.02]}>
        <boxGeometry args={[0.04, 0.04, 0.25]} />
        <meshStandardMaterial color="#333" roughness={0.7} />
      </mesh>
      {/* 팔걸이 기둥 */}
      <mesh position={[-0.24, 0.52, -0.05]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0.24, 0.52, -0.05]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}
