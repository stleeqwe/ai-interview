'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar3DModel } from './Avatar3DModel';
import { CAMERA } from './avatar/constants';

interface Avatar3DCanvasProps {
  modelPath?: string;
}

export function Avatar3DCanvas({ modelPath }: Avatar3DCanvasProps) {
  return (
    <div className="relative w-full h-full">
      {/* 2D 배경 이미지 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/office-bg.png)' }}
      />

      {/* 3D 캔버스 (투명 배경) */}
      <Canvas
        className="absolute inset-0"
        camera={{
          fov: CAMERA.FOV,
          position: CAMERA.POSITION as unknown as [number, number, number],
          near: 0.01,
          far: 50,
        }}
        gl={{
          powerPreference: 'default',
          antialias: true,
          alpha: true,
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
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor(0x000000, 0);

          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('[Avatar3D] WebGL context lost');
          });
        }}
      >
        {/* 라이팅 — 배경 이미지의 조명 톤에 맞춤 */}
        <directionalLight position={[0.5, 3, 2]} intensity={1.5} color="#fff8f0" />
        <directionalLight position={[-2, 2, 1]} intensity={0.4} color="#e8f0ff" />
        <directionalLight position={[0, 2, -2]} intensity={0.3} color="#ffe8cc" />
        <ambientLight intensity={0.35} color="#f0e8dd" />
        <pointLight position={[0, 2.9, 0.5]} intensity={0.6} color="#fff5e8" distance={6} decay={2} />

        {/* 아바타 모델 */}
        <Suspense fallback={null}>
          <Avatar3DModel modelPath={modelPath} />
        </Suspense>
      </Canvas>
    </div>
  );
}
