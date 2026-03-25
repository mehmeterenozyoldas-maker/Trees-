import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { generateTree } from '../lib/treeGenerator';
import { Particles } from './Particles';

const _object = new THREE.Object3D();
const noise3D = createNoise3D();

export function Tree({ growth, windStrength = 1, season = 'spring' }: { growth: number, windStrength?: number, season?: string }) {
  const { branches, leaves } = useMemo(() => generateTree(), []);
  
  const branchMeshRef = useRef<THREE.InstancedMesh>(null);
  const leafMeshRef = useRef<THREE.InstancedMesh>(null);
  const seasonScaleRef = useRef(1);

  const branchGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.75, 1.0, 1, 6);
    geo.translate(0, 0.5, 0);
    return geo;
  }, []);

  const leafGeometry = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    geo.scale(1, 0.2, 1);
    return geo;
  }, []);

  useEffect(() => {
    if (leafMeshRef.current) {
      const color = new THREE.Color();
      leaves.forEach((leaf, i) => {
        const rand1 = (leaf.id * 12.34) % 1.0;
        const rand2 = (leaf.id * 56.78) % 1.0;
        
        if (season === 'spring') {
          color.copy(leaf.color);
        } else if (season === 'summer') {
          color.setHSL(0.25 + rand1 * 0.1, 0.6, 0.4 + rand2 * 0.2);
        } else if (season === 'autumn') {
          color.setHSL(0.05 + rand1 * 0.1, 0.8, 0.4 + rand2 * 0.2);
        } else if (season === 'winter') {
          color.setHSL(0.6, 0.1, 0.8 + rand1 * 0.2);
        }
        
        leafMeshRef.current!.setColorAt(i, color);
      });
      leafMeshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [leaves, season]);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    
    const targetSeasonScale = season === 'winter' ? 0 : 1;
    seasonScaleRef.current = THREE.MathUtils.lerp(seasonScaleRef.current, targetSeasonScale, delta * 3);

    if (branchMeshRef.current) {
      branches.forEach((branch, i) => {
        let progress = 0;
        if (growth >= branch.endProgress) {
          progress = 1;
        } else if (growth > branch.startProgress) {
          progress = (growth - branch.startProgress) / (branch.endProgress - branch.startProgress);
          // Ease out cubic
          progress = 1 - Math.pow(1 - progress, 3);
        }

        if (progress > 0) {
          _object.position.copy(branch.startPos);
          _object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), branch.dir);
          _object.scale.set(branch.radius * progress, branch.length * progress, branch.radius * progress);
          _object.updateMatrix();
          branchMeshRef.current!.setMatrixAt(i, _object.matrix);
        } else {
          _object.scale.set(0, 0, 0);
          _object.updateMatrix();
          branchMeshRef.current!.setMatrixAt(i, _object.matrix);
        }
      });
      branchMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (leafMeshRef.current) {
      leaves.forEach((leaf, i) => {
        let progress = 0;
        if (growth >= leaf.endProgress) {
          progress = 1;
        } else if (growth > leaf.startProgress) {
          progress = (growth - leaf.startProgress) / (leaf.endProgress - leaf.startProgress);
          // Ease out back
          const c1 = 1.70158;
          const c3 = c1 + 1;
          progress = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
        }

        if (progress > 0 && seasonScaleRef.current > 0.01) {
          // 3D Simplex Noise Vector Field for Wind Sway
          const noiseX = noise3D(leaf.position.x * 0.2, leaf.position.y * 0.2, time * 0.5);
          const noiseZ = noise3D(leaf.position.z * 0.2, leaf.position.y * 0.2 + 100, time * 0.5);
          
          const windX = noiseX * 0.15 * windStrength;
          const windZ = noiseZ * 0.15 * windStrength;
          
          _object.position.copy(leaf.position);
          _object.quaternion.copy(leaf.quaternion);
          _object.rotateX(windX);
          _object.rotateZ(windZ);
          
          const currentScale = leaf.scale * Math.max(0, progress) * seasonScaleRef.current;
          _object.scale.set(currentScale, currentScale, currentScale);
          _object.updateMatrix();
          leafMeshRef.current!.setMatrixAt(i, _object.matrix);
        } else {
          _object.scale.set(0, 0, 0);
          _object.updateMatrix();
          leafMeshRef.current!.setMatrixAt(i, _object.matrix);
        }
      });
      leafMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={branchMeshRef}
        args={[branchGeometry, undefined, branches.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#3a2b22" roughness={0.95} />
      </instancedMesh>

      <instancedMesh
        ref={leafMeshRef}
        args={[leafGeometry, undefined, leaves.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial roughness={0.4} transmission={0.2} thickness={0.1} vertexColors />
      </instancedMesh>

      <Particles count={2000} treeLeaves={leaves} growth={growth} windStrength={windStrength} season={season} />
    </group>
  );
}
