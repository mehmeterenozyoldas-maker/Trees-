import * as THREE from 'three';

export interface BranchData {
  id: number;
  parentId: number;
  level: number;
  startPos: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  radius: number;
  timeStart: number;
  timeEnd: number;
}

export interface LeafData {
  id: number;
  branchId: number;
  position: THREE.Vector3;
  offset: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
  color: THREE.Color;
  timeStart: number;
  timeEnd: number;
}

export function generateTree() {
  const branches: BranchData[] = [];
  const leaves: LeafData[] = [];
  let branchIdCounter = 0;
  let leafIdCounter = 0;

  const maxLevel = 4;
  const phototropism = new THREE.Vector3(0, 1, 0); 
  const gravitropism = new THREE.Vector3(0, -1, 0); 
  
  let maxTime = 0;

  function growSegment(
    parentId: number,
    level: number,
    startPos: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    timeStart: number,
    segmentIndex: number,
    maxSegments: number
  ) {
    const id = branchIdCounter++;
    
    const noiseScale = 0.1 + (level / maxLevel) * 0.4;
    const noiseDir = new THREE.Vector3(
      (Math.random() - 0.5) * noiseScale,
      (Math.random() - 0.5) * noiseScale * 0.5,
      (Math.random() - 0.5) * noiseScale
    );
    
    let currentDir = dir.clone().add(noiseDir).normalize();
    
    const photoBias = 0.15 * Math.max(0, 1 - level / maxLevel); 
    currentDir.lerp(phototropism, photoBias);
    
    if (level > 0) {
      const gravityBias = 0.05 * (level / maxLevel); 
      currentDir.lerp(gravitropism, gravityBias);
    }
    
    currentDir.normalize();

    const endPos = startPos.clone().add(currentDir.clone().multiplyScalar(length));
    
    // Constant elongation speed
    const duration = length;
    const timeEnd = timeStart + duration;
    maxTime = Math.max(maxTime, timeEnd);
    
    branches.push({
      id,
      parentId,
      level,
      startPos,
      dir: currentDir,
      length,
      radius,
      timeStart,
      timeEnd
    });

    const isTerminal = segmentIndex === maxSegments || radius < 0.05;

    if (!isTerminal) {
       growSegment(id, level, endPos, currentDir, length * 0.95, radius * 0.85, timeEnd, segmentIndex + 1, maxSegments);
    }

    if (level < maxLevel) {
        let numLaterals = 0;
        if (isTerminal) {
            numLaterals = Math.floor(Math.random() * 2) + 2; 
        } else {
            if (segmentIndex > 0) {
                const branchChance = 0.8 - (level * 0.15); 
                if (Math.random() < branchChance) {
                    numLaterals = 1 + (Math.random() < 0.25 ? 1 : 0);
                }
            }
        }

        const childRadiusScale = isTerminal ? 0.7 : 0.5;

        for (let i = 0; i < numLaterals; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spread = isTerminal ? (0.3 + Math.random() * 0.3) : (0.6 + Math.random() * 0.4);
            
            const perp = new THREE.Vector3(1, 0, 0).cross(currentDir).normalize();
            if (perp.length() < 0.1) perp.set(0, 0, 1).cross(currentDir).normalize();
            perp.applyAxisAngle(currentDir, angle); 
            
            const childDir = currentDir.clone().applyAxisAngle(perp, spread).normalize();
            
            childDir.y += 0.2;
            childDir.normalize();

            const childLength = length * (isTerminal ? 0.85 : 0.7) * (0.8 + Math.random() * 0.4);
            const childRadius = radius * childRadiusScale;
            // Shorter sub-branches
            const childMaxSegments = Math.max(1, maxSegments - 1);
            
            const childTimeStart = timeEnd + (isTerminal ? 0 : Math.random() * duration * 0.5);

            growSegment(id, level + 1, endPos, childDir, childLength, childRadius, childTimeStart, 0, childMaxSegments);
        }
    }

    if (level >= maxLevel - 2) {
      const numLeaves = isTerminal ? (Math.floor(Math.random() * 8) + 4) : (Math.floor(Math.random() * 3) + 1);
      
      for (let i = 0; i < numLeaves; i++) {
        const offsetDist = Math.random() * 1.5;
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = (Math.random() - 0.5) * Math.PI;
        
        const offsetDir = new THREE.Vector3(
           Math.cos(angle1) * Math.cos(angle2),
           Math.sin(angle2),
           Math.sin(angle1) * Math.cos(angle2)
        ).normalize();
        
        offsetDir.add(currentDir).normalize();
        offsetDir.y += 0.5;
        offsetDir.normalize();

        const offset = offsetDir.multiplyScalar(offsetDist);
        const leafPos = endPos.clone().add(offset);
        
        const upVec = new THREE.Vector3(0, 1, 0);
        const leafQuat = new THREE.Quaternion().setFromUnitVectors(upVec, offsetDir.clone().lerp(upVec, 0.5).normalize());
        
        const hue = 0.28 + Math.random() * 0.05; 
        const sat = 0.6 + Math.random() * 0.2;
        const lit = 0.3 + Math.random() * 0.2;
        const color = new THREE.Color().setHSL(hue, sat, lit);

        const leafTimeStart = timeEnd + Math.random() * duration * 2.0; 
        const leafTimeEnd = leafTimeStart + duration * 1.5;
        maxTime = Math.max(maxTime, leafTimeEnd);

        leaves.push({
          id: leafIdCounter++,
          branchId: id,
          position: leafPos,
          offset: offset,
          quaternion: leafQuat,
          scale: 0.15 + Math.random() * 0.3,
          color,
          timeStart: leafTimeStart,
          timeEnd: leafTimeEnd
        });
      }
    }
  }

  // Trunk
  growSegment(-1, 0, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 2.5, 1.2, 0, 0, 6);

  // Normalize
  for (const b of branches) {
    b.timeStart /= maxTime;
    b.timeEnd /= maxTime;
  }
  for (const l of leaves) {
    l.timeStart /= maxTime;
    l.timeEnd /= maxTime;
  }

  return { branches, leaves };
}
