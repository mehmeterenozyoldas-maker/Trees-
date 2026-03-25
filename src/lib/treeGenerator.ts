import * as THREE from 'three';

export interface BranchData {
  id: number;
  parentId: number;
  level: number;
  startPos: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  radius: number;
  startProgress: number;
  endProgress: number;
}

export interface LeafData {
  id: number;
  branchId: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
  color: THREE.Color;
  startProgress: number;
  endProgress: number;
}

export function generateTree() {
  const branches: BranchData[] = [];
  const leaves: LeafData[] = [];
  let branchIdCounter = 0;
  let leafIdCounter = 0;

  const maxLevel = 7;
  const daVinciExponent = 2.5; // Da Vinci's rule exponent (typically 2.0 - 3.0)
  const phototropism = new THREE.Vector3(0, 1, 0); // Light source direction
  const gravitropism = new THREE.Vector3(0, -1, 0); // Gravity direction

  function growSegment(
    parentId: number,
    level: number,
    startPos: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    startProgress: number,
    segmentIndex: number,
    maxSegments: number
  ) {
    const id = branchIdCounter++;
    
    // 1. Stochastic Noise
    const noiseDir = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.6
    );
    
    let currentDir = dir.clone().add(noiseDir).normalize();
    
    // 2. Phototropism (seeking light)
    const photoBias = 0.15 * (1 - level / maxLevel); // Stronger at base
    currentDir.lerp(phototropism, photoBias);
    
    // 3. Gravitropism (heavy branches droop)
    const gravityBias = 0.05 * (level / maxLevel) * (radius > 0.2 ? 1 : 0.2); // Stronger on thin/long branches
    currentDir.lerp(gravitropism, gravityBias);
    
    currentDir.normalize();

    const endPos = startPos.clone().add(currentDir.clone().multiplyScalar(length));
    
    const duration = 0.06;
    const endProgress = Math.min(startProgress + duration, 1.0);
    
    branches.push({
      id,
      parentId,
      level,
      startPos,
      dir: currentDir,
      length,
      radius,
      startProgress,
      endProgress
    });

    if (segmentIndex < maxSegments) {
      // Continue the same branch, tapering slightly
      growSegment(id, level, endPos, currentDir, length * 0.95, radius * 0.9, endProgress, segmentIndex + 1, maxSegments);
    } else if (level < maxLevel) {
      // Split into child branches
      const numChildren = level === 0 ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2) + 1;
      
      // Da Vinci's Rule: R_parent^n = sum(R_child^n)
      // Assuming equal children for simplicity: R_child = R_parent / (numChildren ^ (1/n))
      const childRadius = radius / Math.pow(numChildren, 1 / daVinciExponent);
      
      for (let i = 0; i < numChildren; i++) {
        const angle1 = (Math.random() - 0.5) * Math.PI * 1.8;
        const angle2 = (Math.random() - 0.5) * Math.PI * 1.8;
        
        const childDir = currentDir.clone()
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), angle1)
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle2)
          .normalize();
          
        // Bias children outwards and upwards
        childDir.y += 0.3;
        childDir.normalize();

        const childLength = length * (0.75 + Math.random() * 0.3);
        const childSegments = Math.max(1, maxSegments - 1);
        
        growSegment(id, level + 1, endPos, childDir, childLength, childRadius, endProgress, 0, childSegments);
      }
    } else {
      // Generate leaves at the end of the terminal branches (phyllotaxis approximation)
      const numLeaves = Math.floor(Math.random() * 15) + 10;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
      
      for (let i = 0; i < numLeaves; i++) {
        // Distribute leaves spherically but biased by golden angle
        const theta = i * goldenAngle;
        const phi = Math.acos(1 - 2 * (i + 0.5) / numLeaves);
        
        const offset = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ).multiplyScalar(1.5 + Math.random() * 1.5);
        
        const leafPos = endPos.clone().add(offset);
        const leafQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), offset.clone().normalize());
        
        // Warm earthy pinks palette with higher variance
        const hue = 0.90 + Math.random() * 0.12; // Pink to deep red
        const sat = 0.5 + Math.random() * 0.4;
        const lit = 0.5 + Math.random() * 0.4;
        const color = new THREE.Color().setHSL(hue, sat, lit);

        leaves.push({
          id: leafIdCounter++,
          branchId: id,
          position: leafPos,
          quaternion: leafQuat,
          scale: 0.15 + Math.random() * 0.35,
          color,
          startProgress: endProgress,
          endProgress: Math.min(endProgress + 0.2, 1.0)
        });
      }
    }
  }

  // Start the trunk
  growSegment(-1, 0, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 1.8, 0.85, 0, 0, 5);

  return { branches, leaves };
}
