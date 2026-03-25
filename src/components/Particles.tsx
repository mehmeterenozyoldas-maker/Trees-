import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { LeafData } from '../lib/treeGenerator';

const _object = new THREE.Object3D();
const noise3D = createNoise3D();

export function Particles({ count = 2000, treeLeaves, growth, windStrength = 1, season = 'spring' }: { count?: number, treeLeaves: LeafData[], growth: number, windStrength?: number, season?: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const leaf = treeLeaves[Math.floor(Math.random() * treeLeaves.length)];
      const rand1 = (i * 12.34) % 1.0;
      const rand2 = (i * 56.78) % 1.0;
      return {
        id: i,
        position: leaf ? leaf.position.clone() : new THREE.Vector3(0, 5, 0),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          -Math.random() * 1 - 0.5,
          (Math.random() - 0.5) * 0.5
        ),
        rotation: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ),
        scale: 0.05 + Math.random() * 0.08,
        color: new THREE.Color().setHSL(0.92 + rand1 * 0.08, 0.5 + rand2 * 0.3, 0.6 + rand2 * 0.3),
        life: Math.random(), // 0 to 1
        state: 'falling' as 'falling' | 'ground'
      };
    });
  }, [count, treeLeaves]);

  useEffect(() => {
    particles.forEach((p, i) => {
      const rand1 = (i * 12.34) % 1.0;
      const rand2 = (i * 56.78) % 1.0;
      if (season === 'spring') {
        p.color.setHSL(0.92 + rand1 * 0.08, 0.5 + rand2 * 0.3, 0.6 + rand2 * 0.3);
      } else if (season === 'summer') {
        p.color.setHSL(0.25 + rand1 * 0.1, 0.6, 0.4 + rand2 * 0.2);
      } else if (season === 'autumn') {
        p.color.setHSL(0.05 + rand1 * 0.1, 0.8, 0.4 + rand2 * 0.2);
      } else if (season === 'winter') {
        p.color.setHSL(0.6, 0.1, 0.8 + rand1 * 0.2);
      }
    });
  }, [season, particles]);

  const geometry = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    geo.scale(1, 0.2, 1);
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || treeLeaves.length === 0) return;

    const time = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      if (growth < 0.8 && season !== 'winter') {
        _object.scale.set(0, 0, 0);
        _object.updateMatrix();
        meshRef.current!.setMatrixAt(i, _object.matrix);
        return;
      }
      
      if (p.state === 'falling') {
        p.position.addScaledVector(p.velocity, delta);
        p.rotation.addScaledVector(p.rotationSpeed, delta);
        
        // 3D Simplex Noise Vector Field for Wind Advection
        const noiseX = noise3D(p.position.x * 0.1, p.position.y * 0.1, time * 0.5);
        const noiseZ = noise3D(p.position.z * 0.1, p.position.y * 0.1 + 100, time * 0.5);
        const noiseY = noise3D(p.position.x * 0.1, p.position.z * 0.1, time * 0.5 + 200);
        
        p.position.x += noiseX * delta * windStrength * 2.0;
        p.position.z += noiseZ * delta * windStrength * 2.0;
        p.position.y += noiseY * delta * windStrength * 0.5; // Slight updrafts
        
        // Directional wind bias
        p.position.x += windStrength * 2.5 * delta;

        if (p.position.y < 0) {
          p.position.y = 0;
          p.state = 'ground';
          p.life = 1.0; // Reset life for ground fading
        }
      } else if (p.state === 'ground') {
        p.life -= delta * 0.05; // Stay on ground longer
        if (p.life <= 0) {
          // Respawn
          if (season === 'winter') {
            p.position.set((Math.random() - 0.5) * 25 - windStrength * 10, 15 + Math.random() * 10, (Math.random() - 0.5) * 25);
          } else {
            const leaf = treeLeaves[Math.floor(Math.random() * treeLeaves.length)];
            p.position.copy(leaf.position);
          }
          p.state = 'falling';
          p.life = 1.0;
        }
      }

      _object.position.copy(p.position);
      _object.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
      
      const scale = p.state === 'ground' ? p.scale * Math.max(0, p.life) : p.scale;
      _object.scale.set(scale, scale, scale);
      _object.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, _object.matrix);
      meshRef.current!.setColorAt(i, p.color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, count]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.8} vertexColors />
    </instancedMesh>
  );
}
