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
        p.scale = 0.05 + rand1 * 0.05;
      } else if (season === 'summer') {
        const baseHSL = {h: 0.28, s: 0.65, l: 0.35};
        p.color.setHSL(baseHSL.h + rand1 * 0.05, baseHSL.s + rand2 * 0.1, baseHSL.l + rand2 * 0.1);
        p.scale = 0.06 + rand1 * 0.06;
      } else if (season === 'autumn') {
        const baseHSL = {h: 0.08, s: 0.85, l: 0.45};
        p.color.setHSL(baseHSL.h + rand1 * 0.08, baseHSL.s - rand2 * 0.1, baseHSL.l + rand2 * 0.15);
        p.scale = 0.05 + rand1 * 0.06;
      } else if (season === 'winter') {
        p.color.setHSL(0.6, 0.1, 0.9 + rand1 * 0.1);
        p.scale = 0.02 + rand1 * 0.04; // Snow is smaller
      }
    });
  }, [season, particles]);

  const leafGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 12, 12);
    geo.scale(0.6, 0.02, 1.0);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        // Twist the petal slightly
        const y = positions.getY(i) + Math.sin(x * 2) * 0.2 + Math.cos(z * 2) * 0.2;
        positions.setY(i, y);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const snowGeometry = useMemo(() => {
    return new THREE.SphereGeometry(1, 8, 8);
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || treeLeaves.length === 0) return;

    const time = state.clock.elapsedTime;
    const isWinter = season === 'winter';

    particles.forEach((p, i) => {
      if (growth < 0.8 && !isWinter) {
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
        
        const floatStrength = isWinter ? 1.0 : 2.0; // Snow floats more steadily
        p.position.x += noiseX * delta * windStrength * floatStrength;
        p.position.z += noiseZ * delta * windStrength * floatStrength;
        p.position.y += noiseY * delta * windStrength * (isWinter ? 0.2 : 0.5); // Slight updrafts
        
        // Directional wind bias
        p.position.x += windStrength * (isWinter ? 1.5 : 2.5) * delta;

        // Apply gravity specifically
        if (isWinter) {
           p.velocity.y -= 0.2 * delta; // Lighter gravity for snow
           p.velocity.y = Math.max(p.velocity.y, -1.0); // Slower terminal velocity
        } else {
           p.velocity.y -= 0.5 * delta;
           p.velocity.y = Math.max(p.velocity.y, -2.0);
        }

        if (p.position.y < 0.05) {
          p.position.y = 0.05;
          p.state = 'ground';
          p.life = 1.0; // Reset life for ground fading
        }
      } else if (p.state === 'ground') {
        p.life -= delta * (isWinter ? 0.02 : 0.05); // Stay on ground longer, especially snow
        if (p.life <= 0) {
          // Respawn
          if (isWinter) {
            p.position.set((Math.random() - 0.5) * 45 - windStrength * 15, 15 + Math.random() * 20, (Math.random() - 0.5) * 45);
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
    <instancedMesh ref={meshRef} args={[undefined as any, undefined, count]} castShadow receiveShadow>
      <primitive object={season === 'winter' ? snowGeometry : leafGeometry} attach="geometry" />
      <meshPhysicalMaterial 
        roughness={season === 'winter' ? 0.8 : 0.4} 
        transmission={season === 'winter' ? 0.2 : 0.2} 
        thickness={0.02} 
        clearcoat={season === 'winter' ? 0.3 : 0.1}
        side={THREE.DoubleSide}
        vertexColors 
      />
    </instancedMesh>
  );
}

