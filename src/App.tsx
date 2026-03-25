import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Noise, Vignette } from '@react-three/postprocessing';
import { Tree } from './components/Tree';
import { Wind, Leaf, Snowflake, Sun } from 'lucide-react';

export default function App() {
  const [growth, setGrowth] = useState(0);
  const [windStrength, setWindStrength] = useState(1);
  const [season, setSeason] = useState('spring');

  // Auto-grow on mount
  useEffect(() => {
    let startTime = Date.now();
    const duration = 6000; // 6 seconds to fully grow
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      setGrowth(progress);
      
      if (progress < 1.0) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, []);

  const seasons = [
    { id: 'spring', icon: Leaf, color: 'text-pink-400', bg: 'bg-pink-100', border: 'border-pink-200' },
    { id: 'summer', icon: Sun, color: 'text-green-500', bg: 'bg-green-100', border: 'border-green-200' },
    { id: 'autumn', icon: Wind, color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-200' },
    { id: 'winter', icon: Snowflake, color: 'text-blue-400', bg: 'bg-blue-100', border: 'border-blue-200' },
  ];

  return (
    <div className="w-full h-screen bg-[#1a1a1a] relative overflow-hidden">
      <Canvas camera={{ position: [0, 8, 16], fov: 45 }} shadows dpr={[1, 2]}>
        <color attach="background" args={['#1a1a1a']} />
        <fog attach="fog" args={['#1a1a1a', 10, 40]} />
        
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 15, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <directionalLight position={[-10, 10, -10]} intensity={0.5} color="#a0c0ff" />
        
        <Tree growth={growth} windStrength={windStrength} season={season} />
        
        <ContactShadows 
          resolution={1024} 
          scale={20} 
          blur={2} 
          opacity={0.6} 
          far={10} 
          color="#000000"
        />
        
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={5}
          maxDistance={25}
          target={[0, 4, 0]}
          autoRotate={growth === 1}
          autoRotateSpeed={0.5}
        />
        <Environment preset="sunset" background blur={0.5} />

        <EffectComposer disableNormalPass>
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
          <Noise opacity={0.02} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-stone-900/80 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl border border-stone-700/50 flex flex-col items-center gap-4 w-96">
        
        {/* Season Selector */}
        <div className="flex justify-between w-full gap-2">
          {seasons.map((s) => {
            const Icon = s.icon;
            const isActive = season === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSeason(s.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${
                  isActive ? `${s.bg} ${s.border} shadow-sm` : 'border-stone-700 hover:bg-stone-800'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${isActive ? s.color : 'text-stone-400'}`} />
                <span className={`text-xs font-medium capitalize ${isActive ? 'text-stone-800' : 'text-stone-400'}`}>
                  {s.id}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-full h-px bg-stone-700/50" />

        {/* Wind Control */}
        <div className="w-full flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1">
              <Wind className="w-3 h-3" /> Wind Strength
            </label>
            <span className="text-xs font-medium text-stone-300">{windStrength.toFixed(1)}x</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="3" 
            step="0.1" 
            value={windStrength}
            onChange={(e) => setWindStrength(parseFloat(e.target.value))}
            className="w-full accent-stone-400"
          />
        </div>

        {/* Growth Control */}
        <div className="w-full flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Growth Progress
            </label>
            <span className="text-xs font-medium text-stone-300">{Math.round(growth * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={growth}
            onChange={(e) => setGrowth(parseFloat(e.target.value))}
            className="w-full accent-pink-400"
          />
        </div>

      </div>
    </div>
  );
}
