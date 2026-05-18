import { Canvas } from "@react-three/fiber"
import { Stars, Sparkles, Cloud } from "@react-three/drei"
import { Suspense } from "react"
import * as THREE from "three"

function Galaxy() {
  return (
    <>
      <color attach="background" args={['#030508']} />
      
      {/* Dynamic Stars */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* Cyan Nebulae / Fog */}
      <fog attach="fog" args={["#00f0ff", 30, 100]} />
      
      {/* Ambient glowing particles */}
      <Sparkles count={400} scale={100} size={4} speed={0.4} color="#00f0ff" opacity={0.3} />
      <Sparkles count={200} scale={80} size={6} speed={0.2} color="#0088ff" opacity={0.2} />

      {/* Cloud-based nebulae effect */}
      <Suspense fallback={null}>
        <group position={[0, 0, -30]}>
          <Cloud position={[-15, 5, -20]} speed={0.2} opacity={0.15} bounds={[10, 10, 2]} color="#00f0ff" segments={40} volume={20} />
          <Cloud position={[15, -5, -30]} speed={0.2} opacity={0.1} bounds={[10, 10, 2]} color="#4a00ff" segments={40} volume={20} />
        </group>
      </Suspense>

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#00f0ff" />
    </>
  )
}

export function SpaceBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-[#030508]">
      <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
        <Galaxy />
      </Canvas>
      {/* Overlay gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030508]/50 to-[#030508] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00f0ff]/5 via-transparent to-transparent pointer-events-none opacity-60 mix-blend-screen" />
    </div>
  )
}
