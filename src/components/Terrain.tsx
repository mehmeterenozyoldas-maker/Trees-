import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { createNoise3D } from 'simplex-noise';

export function Terrain({ season }: { season: string }) {
  const noise = createNoise3D();
  
  const geometry = useMemo(() => {
    // Large, detailed plane
    const geo = new THREE.PlaneGeometry(160, 160, 256, 256);
    geo.rotateX(-Math.PI / 2);
    
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        
        const dist2 = x*x + z*z;
        const dist = Math.sqrt(dist2);
        
        let y = 0;
        
        // Rolling noise layers
        y += noise(x * 0.015, 0, z * 0.015) * 4.0;
        y += noise(x * 0.05, 0, z * 0.05) * 1.5;
        y += noise(x * 0.15, 0, z * 0.15) * 0.4;
        
        // Flatten the terrain near the origin (where the tree is)
        const flattenFactor = Math.min(1, Math.max(0, (dist - 2) / 10));
        y = y * flattenFactor;
        
        // Add a gentle mound for the tree
        const hill = Math.exp(-dist2 / 40) * 0.8;
        y += hill;
        
        // Lower everything slightly so the tree base sits nicely
        y -= 0.6;
        
        pos.setY(i, y);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);

  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const uniforms = useRef({
    uSeason: { value: 0 } // 0: Spring/Summer, 1: Autumn, 2: Winter
  });

  useFrame((_, delta) => {
    let target = 0;
    if (season === 'autumn') target = 1;
    if (season === 'winter') target = 2;
    
    uniforms.current.uSeason.value = THREE.MathUtils.lerp(
      uniforms.current.uSeason.value,
      target,
      delta * 2
    );
  });

  const onBeforeCompile = (shader: THREE.Shader) => {
    shader.uniforms.uSeason = uniforms.current.uSeason;
    
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
      `
    );
    
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      uniform float uSeason;

      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      `
    );
    
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      
      float n1 = snoise(vWorldPosition.xz * 0.2);
      float n2 = snoise(vWorldPosition.xz * 1.5);
      float detailNoise = n1 * 0.8 + n2 * 0.2;
      
      // Colors
      vec3 colorSpringGrass = vec3(0.18, 0.35, 0.12);
      vec3 colorSummerGrass = vec3(0.25, 0.40, 0.15);
      vec3 colorAutumnGrass = vec3(0.40, 0.32, 0.15);
      vec3 colorDirt = vec3(0.35, 0.25, 0.18);
      vec3 colorRock = vec3(0.3, 0.3, 0.32);
      vec3 colorSnow = vec3(0.85, 0.88, 0.95);
      
      float slope = 1.0 - vWorldNormal.y;
      
      // Determine seasons
      float mixAutumn = clamp(uSeason, 0.0, 1.0);
      float mixWinter = clamp(uSeason - 1.0, 0.0, 1.0);
      
      // Spring to Summer to Autumn Grass
      vec3 baseGrass = mix(colorSpringGrass, colorSummerGrass, 0.5); // Simplification, could animate
      baseGrass = mix(baseGrass, colorAutumnGrass, mixAutumn);
      
      // Dirt transition based on noise
      float dirtMix = smoothstep(0.2, 0.6, detailNoise * 0.5 + 0.5);
      vec3 groundColor = mix(baseGrass, colorDirt, dirtMix * 0.6); // 60% dirt at max
      
      // Steeper slopes become rock/dirt
      float rockMix = smoothstep(0.15, 0.35, slope + detailNoise * 0.1);
      groundColor = mix(groundColor, mix(colorDirt, colorRock, 0.5), rockMix);
      
      // Winter snow covers flat ground and accumulates on tops
      float snowAmount = smoothstep(0.4, 0.1, slope - detailNoise * 0.05); 
      // More snow in winter
      groundColor = mix(groundColor, colorSnow, mixWinter * snowAmount);
      
      // Inject some slight variation to the diffuse color
      diffuseColor.rgb = groundColor * (0.85 + 0.15 * n2);
      `
    );
  };

  return (
    <mesh geometry={geometry} receiveShadow position={[0, -0.1, 0]}>
      <meshStandardMaterial 
        ref={materialRef} 
        roughness={0.9}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}
