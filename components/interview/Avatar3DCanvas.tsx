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
      }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 1.5]}
      onCreated={({ camera, gl }) => {
        // 카메라를 면접관 상반신 방향으로 향하게
        camera.lookAt(
          new THREE.Vector3(
            CAMERA.TARGET[0],
            CAMERA.TARGET[1],
            CAMERA.TARGET[2]
          )
        );

        // WebGL 컨텍스트 손실 대응
        const canvas = gl.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.warn('[Avatar3D] WebGL context lost');
        });
      }}
    >
      {/* 배경색 */}
      <color attach="background" args={[OFFICE.BG_COLOR]} />
      <fog attach="fog" args={[OFFICE.BG_COLOR, 4, 12]} />

      {/* 조명 */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[1, 3, 2]} intensity={1.0} color="#fff5e6" />
      <directionalLight position={[-2, 2, 1]} intensity={0.3} color="#e6f0ff" />
      <pointLight position={[0, 3, 0]} intensity={0.4} color="#fff0dd" distance={8} />

      {/* 사무실 환경 */}
      <OfficeScene />

      {/* VRM 모델 */}
      <Suspense fallback={null}>
        <Avatar3DModel />
      </Suspense>
    </Canvas>
  );
}
