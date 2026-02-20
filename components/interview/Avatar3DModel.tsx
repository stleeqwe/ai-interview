'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { useIdleAnimations } from './avatar/useIdleAnimations';
import { useVrmAnimations } from './avatar/useVrmAnimations';
import { useLipSync } from './avatar/useLipSync';

const MODEL_PATH = '/models/interviewer.vrm';

export function Avatar3DModel() {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  const idle = useIdleAnimations();
  const vrmAnims = useVrmAnimations();
  const lipSync = useLipSync();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gltf = useLoader(GLTFLoader, MODEL_PATH, (loader: any) => {
    loader.register((parser: any) => new VRMLoaderPlugin(parser));
  });

  useEffect(() => {
    if (!gltf) return;

    const loadedVrm = gltf.userData?.vrm as VRM | undefined;
    if (loadedVrm) {
      // LookAt 수동 제어
      if (loadedVrm.lookAt) {
        loadedVrm.lookAt.autoUpdate = false;
      }
      setVrm(loadedVrm);
    }
  }, [gltf]);

  useFrame((state, delta) => {
    if (!vrm) return;

    vrm.update(delta);
    resetBoneTransforms(vrm);

    idle.update(vrm, delta);
    vrmAnims.update(vrm, delta);
    lipSync.update(vrm);

    vrm.expressionManager?.update();

    if (vrm.lookAt) {
      vrm.lookAt.lookAt(state.camera.position);
    }
  });

  if (!vrm) return null;

  return (
    <group ref={groupRef}>
      <primitive object={vrm.scene} />
    </group>
  );
}

function resetBoneTransforms(vrm: VRM) {
  const bones = ['head', 'spine', 'neck'] as const;
  for (const boneName of bones) {
    const bone = vrm.humanoid?.getNormalizedBoneNode(boneName);
    if (bone) {
      bone.rotation.set(0, 0, 0);
    }
  }
}
