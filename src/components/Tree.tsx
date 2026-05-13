import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { generateTree } from '../lib/treeGenerator';
import { Particles } from './Particles';

const _object = new THREE.Object3D();
const noise3D = createNoise3D();

function useBarkTextures() {
  return useMemo(() => {
    const width = 512;
    const height = 512;
    const colorCanvas = document.createElement('canvas');
    const normalCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    colorCanvas.width = width; colorCanvas.height = height;
    normalCanvas.width = width; normalCanvas.height = height;
    roughCanvas.width = width; roughCanvas.height = height;
    
    const cCtx = colorCanvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    const nCtx = normalCanvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    const rCtx = roughCanvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    const noise = createNoise3D();
    
    const cImg = cCtx.createImageData(width, height);
    const nImg = nCtx.createImageData(width, height);
    const rImg = rCtx.createImageData(width, height);
    
    const color1 = new THREE.Color("#1f140e"); // Deep crag shadow
    const color2 = new THREE.Color("#4a3222"); // Base bark brown
    const color3 = new THREE.Color("#6e553f"); // Highlight bark
    const lichenColor = new THREE.Color("#6b705c"); // Mossy/ash grey
    const tempColor = new THREE.Color();

    const heights = new Float32Array(width * height);

    // Helper for turbulent noise
    const turb = (cx: number, cy: number, cz: number) => {
      let t = 0;
      let a = 1;
      let f = 1;
      for (let i = 0; i < 4; i++) {
        t += Math.abs(noise(cx * f, cy * f, cz * f)) * a;
        a *= 0.5;
        f *= 2;
      }
      return t;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        
        // For seamless seams around the cylinder (X axis):
        const angleX = nx * Math.PI * 2;
        const radX = 3.0; // Radius controls the horizontal frequency
        const cx = Math.cos(angleX) * radX;
        const cz = Math.sin(angleX) * radX;

        // Linear Y with fade cross-boundary to make Y seamless
        let crack1 = turb(cx * 1.5, ny * 3, cz * 1.5);
        let crack2 = turb(cx * 1.5, (ny - 1) * 3, cz * 1.5);
        let crack = crack1 * (1 - ny) + crack2 * ny; 
        crack = 1.0 - crack;
        crack = Math.pow(Math.max(0, crack), 2.0);
        
        let p1 = noise(cx * 4, ny * 6, cz * 4);
        let p2 = noise(cx * 4, (ny - 1) * 6, cz * 4);
        let plates = (p1 * (1 - ny) + p2 * ny) * 0.5 + 0.5;
        
        let g1 = noise(cx * 15, ny * 15, cz * 15);
        let g2 = noise(cx * 15, (ny - 1) * 15, cz * 15);
        let grain = (g1 * (1 - ny) + g2 * ny) * 0.5 + 0.5;
        
        let bump = crack * 0.6 + plates * 0.3 + grain * 0.1;
        
        heights[y * width + x] = bump;
        
        if (bump < 0.4) {
             tempColor.copy(color1).lerp(color2, bump / 0.4);
        } else {
             tempColor.copy(color2).lerp(color3, (bump - 0.4) / 0.6);
        }
        
        let b1 = Math.abs(noise(cx * 0.5, ny * 30, cz * 0.5));
        let b2 = Math.abs(noise(cx * 0.5, (ny - 1) * 30, cz * 0.5));
        let banding = b1 * (1 - ny) + b2 * ny;
        if (banding < 0.1) {
            tempColor.lerp(color1, (0.1 - banding) * 5.0);
        }

        let l1 = noise(cx * 0.8, ny * 5, cz * 0.8);
        let l2 = noise(cx * 0.8, (ny - 1) * 5, cz * 0.8);
        let lichen = (l1 * (1 - ny) + l2 * ny) * 0.5 + 0.5;
        
        if (lichen > 0.65) {
            tempColor.lerp(lichenColor, (lichen - 0.65) * 2.5);
        }

        const i = (y * width + x) * 4;
        cImg.data[i] = Math.floor(Math.max(0, Math.min(1, tempColor.r)) * 255);
        cImg.data[i+1] = Math.floor(Math.max(0, Math.min(1, tempColor.g)) * 255);
        cImg.data[i+2] = Math.floor(Math.max(0, Math.min(1, tempColor.b)) * 255);
        cImg.data[i+3] = 255;
        
        // Roughness map (0 is smooth/shiny, 255 is rough)
        // Cherry bark can have slight shine on the bands or smooth parts
        let roughMix = 0.5 + (1.0 - bump) * 0.4; // Crevices are rougher
        let roughVal = Math.floor(Math.max(0, Math.min(1, roughMix)) * 255);
        rImg.data[i] = roughVal;
        rImg.data[i+1] = roughVal;
        rImg.data[i+2] = roughVal;
        rImg.data[i+3] = 255;
      }
    }

    // Pass 2: calculate normal map from heights
    const normalStrength = 6.0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const xL = x === 0 ? width - 1 : x - 1;
        const xR = x === width - 1 ? 0 : x + 1;
        const yU = y === 0 ? height - 1 : y - 1;
        const yD = y === height - 1 ? 0 : y + 1;

        const hL = heights[y * width + xL];
        const hR = heights[y * width + xR];
        const hU = heights[yU * width + x];
        const hD = heights[yD * width + x];

        const dx = (hR - hL) * normalStrength;
        const dy = (hD - hU) * normalStrength; // Since Y grows down in canvas
        
        const norm = new THREE.Vector3(-dx, -dy, 1.0).normalize();

        const i = (y * width + x) * 4;
        // Pack normals to 0..255
        nImg.data[i] = Math.floor((norm.x * 0.5 + 0.5) * 255);
        nImg.data[i+1] = Math.floor((norm.y * 0.5 + 0.5) * 255);
        nImg.data[i+2] = Math.floor((norm.z * 0.5 + 0.5) * 255);
        nImg.data[i+3] = 255;
      }
    }

    cCtx.putImageData(cImg, 0, 0);
    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const colorMap = new THREE.CanvasTexture(colorCanvas);
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(1, 4);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 16;

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(1, 4);
    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.anisotropy = 16;
    
    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(1, 4);
    roughnessMap.colorSpace = THREE.NoColorSpace;

    return { colorMap, normalMap, roughnessMap };
  }, []);
}

export function Tree({ growth, windStrength = 1, season = 'spring' }: { growth: number, windStrength?: number, season?: string }) {
  const { branches, leaves } = useMemo(() => generateTree(), []);
  const { colorMap, normalMap, roughnessMap } = useBarkTextures();
  
  const branchMeshRef = useRef<THREE.InstancedMesh>(null);
  const jointMeshRef = useRef<THREE.InstancedMesh>(null);
  const leafMeshRef = useRef<THREE.InstancedMesh>(null);
  const seasonScaleRef = useRef(1);

  const branchGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.85, 1.0, 1, 24, 8);
    geo.translate(0, 0.5, 0);
    
    // Add procedural noise to the trunk geometry for organic look
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const angle = Math.atan2(z, x);
        const radius = Math.sqrt(x*x + z*z);
        // Slightly less aggressive vertex noise so normal map shows better
        const n = noise3D(Math.cos(angle) * 2, y * 2, Math.sin(angle) * 2) * 0.03;
        pos.setX(i, x + Math.cos(angle) * n * radius);
        pos.setZ(i, z + Math.sin(angle) * n * radius);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const jointGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    // Deform sphere to look like a gnarly joint
    const pos = geo.attributes.position;
    for(let i=0; i<pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = noise3D(x * 3, y * 3, z * 3) * 0.1;
        pos.setXYZ(i, x * (1+n), y * (1+n), z * (1+n));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const leafGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 16, 16);
    geo.scale(0.5, 0.05, 1.2);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i) + Math.abs(x) * 0.4;
      positions.setY(i, y);
    }
    geo.computeVertexNormals();
    
    // UVS for normal mapping (if added later)
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
          const baseHSL = {h: 0.28, s: 0.65, l: 0.35};
          color.setHSL(baseHSL.h + rand1 * 0.05, baseHSL.s + rand2 * 0.1, baseHSL.l + rand2 * 0.1);
        } else if (season === 'autumn') {
          const baseHSL = {h: 0.08, s: 0.85, l: 0.45};
          color.setHSL(baseHSL.h + rand1 * 0.08, baseHSL.s - rand2 * 0.1, baseHSL.l + rand2 * 0.15);
        } else if (season === 'winter') {
          color.setHSL(0.6, 0.1, 0.9 + rand1 * 0.1);
        }
        
        leafMeshRef.current!.setColorAt(i, color);
      });
      leafMeshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [leaves, season]);

  const endPosX = useRef<Float32Array>(new Float32Array(0));
  const endPosY = useRef<Float32Array>(new Float32Array(0));
  const endPosZ = useRef<Float32Array>(new Float32Array(0));
  
  // Re-allocate arrays if branches change
  useEffect(() => {
    endPosX.current = new Float32Array(branches.length);
    endPosY.current = new Float32Array(branches.length);
    endPosZ.current = new Float32Array(branches.length);
  }, [branches]);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const globalGust = noise3D(time * 0.1, 0, 0) * 0.5 + 0.5;
    
    const targetSeasonScale = season === 'winter' ? 0.0 : 1;
    seasonScaleRef.current = THREE.MathUtils.lerp(seasonScaleRef.current, targetSeasonScale, delta * 3);

    if (branchMeshRef.current && endPosX.current.length === branches.length) {
      branches.forEach((branch, i) => {
        let lenProgress = 0;
        let radProgress = 0;

        if (growth > branch.timeStart) {
          if (growth >= branch.timeEnd) {
            lenProgress = 1;
          } else {
            lenProgress = (growth - branch.timeStart) / (branch.timeEnd - branch.timeStart);
            lenProgress = 1 - Math.pow(1 - lenProgress, 3); // Ease out cubic
          }
          
          radProgress = Math.min(1, (growth - branch.timeStart) / (1.0001 - branch.timeStart));
          radProgress = Math.pow(radProgress, 0.4); 
        }

        let startPos = new THREE.Vector3(0, 0, 0);
        if (branch.parentId !== -1) {
          startPos.set(
            endPosX.current[branch.parentId],
            endPosY.current[branch.parentId],
            endPosZ.current[branch.parentId]
          );
        }

        if (lenProgress > 0) {
          // Dynamic wind sway based on actual current thickness
          const currentThickness = branch.radius * radProgress;
          const flexibility = Math.max(0.01, 1.0 - Math.pow(currentThickness, 0.5) * 1.5); // Thicker = highly stiff
          
          const swayNoiseX = noise3D(startPos.x * 0.1, startPos.y * 0.1, time * 0.2);
          const swayNoiseZ = noise3D(startPos.x * 0.1, startPos.y * 0.1 + 100, time * 0.2);
          const jitterX = flexibility > 0.5 ? noise3D(startPos.x, startPos.y, time * 1.5) * 0.05 : 0;
          const jitterZ = flexibility > 0.5 ? noise3D(startPos.x, startPos.y + 100, time * 1.5) * 0.05 : 0;
          
          const swayX = (swayNoiseX * 0.08 + jitterX) * windStrength * flexibility * (0.4 + 0.6 * globalGust);
          const swayZ = (swayNoiseZ * 0.08 + jitterZ) * windStrength * flexibility * (0.4 + 0.6 * globalGust);

          const currentDir = branch.dir.clone();
          currentDir.x += swayX;
          currentDir.z += swayZ;
          currentDir.normalize();
          
          const lengthScaled = branch.length * lenProgress;
          const endPos = startPos.clone().add(currentDir.clone().multiplyScalar(lengthScaled));
          
          endPosX.current[i] = endPos.x;
          endPosY.current[i] = endPos.y;
          endPosZ.current[i] = endPos.z;

          _object.position.copy(startPos);
          _object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), currentDir);
          _object.scale.set(branch.radius * radProgress, lengthScaled, branch.radius * radProgress);
          _object.updateMatrix();
          branchMeshRef.current!.setMatrixAt(i, _object.matrix);
          
          _object.quaternion.identity();
          _object.scale.set(branch.radius * radProgress, branch.radius * radProgress, branch.radius * radProgress);
          _object.updateMatrix();
          jointMeshRef.current!.setMatrixAt(i, _object.matrix);
        } else {
          // Set to parent position but 0 scale so it doesn't float
          endPosX.current[i] = startPos.x;
          endPosY.current[i] = startPos.y;
          endPosZ.current[i] = startPos.z;

          _object.scale.set(0, 0, 0);
          _object.updateMatrix();
          branchMeshRef.current!.setMatrixAt(i, _object.matrix);
          if (jointMeshRef.current) jointMeshRef.current.setMatrixAt(i, _object.matrix);
        }
      });
      branchMeshRef.current.instanceMatrix.needsUpdate = true;
      if (jointMeshRef.current) jointMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (leafMeshRef.current && endPosX.current.length === branches.length) {
      leaves.forEach((leaf, i) => {
        let progress = 0;
        if (growth >= leaf.timeEnd) {
          progress = 1;
        } else if (growth > leaf.timeStart) {
          progress = (growth - leaf.timeStart) / (leaf.timeEnd - leaf.timeStart);
          const c1 = 1.70158;
          const c3 = c1 + 1;
          progress = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
        }

        if (progress > 0 && seasonScaleRef.current > 0.01) {
          // Parent branch's final calculated tip position
          const parentEndPos = new THREE.Vector3(
            endPosX.current[leaf.branchId],
            endPosY.current[leaf.branchId],
            endPosZ.current[leaf.branchId]
          );

          const currentLeafPos = parentEndPos.clone().add(leaf.offset);

          const flutterSpeed = time * (0.8 + windStrength * 0.8);
          const flutterX = noise3D(currentLeafPos.x * 0.5, currentLeafPos.y * 0.5, flutterSpeed) * windStrength * 0.4;
          const flutterY = noise3D(currentLeafPos.x * 0.5 + 10, currentLeafPos.y * 0.5 + 10, flutterSpeed * 1.1) * windStrength * 0.4;
          const flutterZ = noise3D(currentLeafPos.x * 0.5 + 20, currentLeafPos.y * 0.5 + 20, flutterSpeed * 0.9) * windStrength * 0.4;
          
          const windOffset = new THREE.Vector3(flutterX * 0.1, flutterY * 0.1, flutterZ * 0.1);
          
          _object.position.copy(currentLeafPos).add(windOffset);
          _object.quaternion.copy(leaf.quaternion);
          
          const baseWindBypass = windStrength * 0.1;
          _object.rotateX(flutterX + baseWindBypass);
          _object.rotateY(flutterY);
          _object.rotateZ(flutterZ + baseWindBypass);
          
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
        <meshStandardMaterial 
          color="#ffffff" 
          map={colorMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(1.2, 1.2)}
          roughnessMap={roughnessMap}
        />
      </instancedMesh>

      <instancedMesh
        ref={jointMeshRef}
        args={[jointGeometry, undefined, branches.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color="#ffffff" 
          map={colorMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(1.2, 1.2)}
          roughnessMap={roughnessMap}
        />
      </instancedMesh>

      <instancedMesh
        ref={leafMeshRef}
        args={[leafGeometry, undefined, leaves.length]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial 
          roughness={0.25} 
          transmission={0.3} 
          thickness={0.05} 
          clearcoat={0.1} 
          clearcoatRoughness={0.8} 
          attenuationColor="#ffffff" 
          attenuationDistance={0.5}
          side={THREE.DoubleSide}
          vertexColors 
        />
      </instancedMesh>

      <Particles count={3000} treeLeaves={leaves} growth={growth} windStrength={windStrength} season={season} />
    </group>
  );
}
