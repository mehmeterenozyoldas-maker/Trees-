import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Sky } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Noise, Vignette, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { Tree } from './components/Tree';
import { Wind, Leaf, Snowflake, Sun, Clock } from 'lucide-react';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

export default function App() {
  const [growth, setGrowth] = useState(0);
  const [windStrength, setWindStrength] = useState(1);
  const [season, setSeason] = useState('spring');
  const [timeOfDay, setTimeOfDay] = useState(14); // 14:00 (2 PM)

  const sunAngle = ((timeOfDay - 6) / 12) * Math.PI;
  const sunY = Math.sin(sunAngle) * 50;
  const sunX = Math.cos(sunAngle) * 50;
  const sunZ = Math.cos(sunAngle) * -20;

  const lightIntensity = Math.max(0.0, Math.sin(sunAngle)) * 3.5;
  const ambientIntensity = Math.max(0.1, Math.sin(sunAngle) * 0.6 + 0.1);

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
    <div className="w-full h-screen bg-[#0a0a0a] relative overflow-hidden">
      <Canvas 
        camera={{ position: [0, 8, 20], fov: 40 }} 
        shadows 
        dpr={[1, 2]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <Sky 
          sunPosition={[sunX, sunY, sunZ]} 
          turbidity={season === 'autumn' ? 3 : 0.4} 
          rayleigh={season === 'winter' ? 1.5 : 0.6} 
          mieCoefficient={0.005} 
          mieDirectionalG={0.8} 
        />
        
        <ambientLight intensity={ambientIntensity} />
        <directionalLight 
          position={[sunX, Math.max(0.1, sunY), sunZ]} 
          intensity={lightIntensity} 
          castShadow 
          shadow-mapSize={[4096, 4096]}
          shadow-camera-near={0.5}
          shadow-camera-far={80}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-10, 10, -10]} intensity={1.0} color="#6080ff" />
        
        <Tree growth={growth} windStrength={windStrength} season={season} />
        
        <ContactShadows 
          resolution={2048} 
          scale={30} 
          blur={2.5} 
          opacity={0.8} 
          far={10} 
          color="#000000"
        />
        
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 6} 
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={8}
          maxDistance={35}
          target={[0, 6, 0]}
          autoRotate={growth === 1}
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
        />
        <Environment preset="park" background={false} environmentIntensity={0.6} />

        <EffectComposer enableNormalPass={false} multisampling={0}>
          <N8AO aoRadius={2} intensity={2} aoSamples={6} denoiseSamples={4} color="#000000" />
          <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={3} height={480} />
          <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} intensity={1.5} mipmapBlur />
          <SMAA />
          <ToneMapping mode={THREE.ACESFilmicToneMapping} />
          <Noise opacity={0.03} blendFunction={BlendFunction.OVERLAY} />
          <Vignette eskil={false} offset={0.1} darkness={1.2} />
        </EffectComposer>
      </Canvas>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-stone-900/40 backdrop-blur-xl px-8 py-5 rounded-3xl shadow-2xl border border-white/10 flex flex-col items-center gap-5 w-96 transform transition-transform hover:scale-[1.02]">
        
        {/* Season Selector */}
        <div className="flex justify-between w-full gap-3">
          {seasons.map((s) => {
            const Icon = s.icon;
            const isActive = season === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSeason(s.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-2xl border transition-all duration-300 ${
                  isActive ? `${s.bg} ${s.border} shadow-[0_0_15px_rgba(255,255,255,0.1)] scale-105` : 'border-white/5 hover:bg-white/5 hover:border-white/20'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1.5 transition-colors ${isActive ? s.color : 'text-stone-400'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-stone-800' : 'text-stone-400'}`}>
                  {s.id}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Time of Day Control */}
        <div className="w-full flex flex-col gap-2 relative group">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Time of Day
            </label>
            <span className="text-xs font-mono text-white/80">
              {Math.floor(timeOfDay).toString().padStart(2, '0')}:
              {((timeOfDay % 1) * 60).toString().padStart(2, '0')}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="24" 
            step="0.25" 
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-400 hover:bg-white/20 transition-all"
          />
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Wind Control */}
        <div className="w-full flex flex-col gap-2 relative group">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
              <Wind className="w-3.5 h-3.5" /> Wind Strength
            </label>
            <span className="text-xs font-mono text-white/80">{windStrength.toFixed(1)}x</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="3" 
            step="0.05" 
            value={windStrength}
            onChange={(e) => setWindStrength(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-stone-300 hover:bg-white/20 transition-all"
          />
        </div>

        {/* Growth Control */}
        <div className="w-full flex flex-col gap-2 relative group">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              Growth Progress
            </label>
            <span className="text-xs font-mono text-white/80">{Math.round(growth * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.005" 
            value={growth}
            onChange={(e) => setGrowth(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-pink-400 hover:bg-white/20 transition-all"
          />
        </div>

      </div>
    </div>
  );
}
