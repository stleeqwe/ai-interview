'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar3DModel } from './Avatar3DModel';
import { OfficeScene } from './OfficeScene';
import { CAMERA, OFFICE } from './avatar/constants';

export function Avatar3DCanvas() {
  return (
    <Canvas
      camera={{
        fov: CAMERA.FOV,
        position: CAMERA.POSITION as unknown as [number, number, number],
        near: 0.01,
        far: 50,
      }}
      gl={{
        powerPreference: 'default',
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      shadows={false}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 1.5]}
      onCreated={({ camera, gl }) => {
        camera.lookAt(
          new THREE.Vector3(CAMERA.TARGET[0], CAMERA.TARGET[1], CAMERA.TARGET[2])
        );
        // 출력 색상 공간
        gl.outputColorSpace = THREE.SRGBColorSpace;

        const canvas = gl.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('[Avatar3D] WebGL context lost');
        });
      }}
    >
      <color attach="background" args={[OFFICE.BG_COLOR]} />
      <fog attach="fog" args={[OFFICE.BG_COLOR, 5, 12]} />

      {/* 메인 키 라이트: 천장 약간 앞에서 */}
      <directionalLight position={[0.5, 3, 2]} intensity={1.5} color="#fff8f0" />
      {/* 필 라이트: 왼쪽 부드럽게 */}
      <directionalLight position={[-2, 2, 1]} intensity={0.4} color="#e8f0ff" />
      {/* 림 라이트: 뒤에서 */}
      <directionalLight position={[0, 2, -2]} intensity={0.3} color="#ffe8cc" />
      {/* 전체 앰비언트 */}
      <ambientLight intensity={0.35} color="#f0e8dd" />
      {/* 천장 패널 시뮬레이션 */}
      <pointLight position={[0, 2.9, 0.5]} intensity={0.6} color="#fff5e8" distance={6} decay={2} />

      {/* 사무실 환경 */}
      <OfficeScene />

      {/* 아바타 모델 */}
      <Suspense fallback={null}>
        <Avatar3DModel />
      </Suspense>
    </Canvas>
  );
}
