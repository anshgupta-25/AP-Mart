import { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows, RoundedBox, Sphere } from "@react-three/drei";
import * as THREE from "three";

// Client-only mount to avoid SSR issues with WebGL
export function Hero3D() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="aspect-square w-full grid place-items-center">
        <div className="h-64 w-64 rounded-[3rem] bg-card border-4 border-foreground/10 animate-pulse" />
      </div>
    );
  }
  return (
    <div className="aspect-square w-full">
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0.5, 6], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 6, 5]} intensity={1.1} castShadow />
          <directionalLight position={[-5, 2, -3]} intensity={0.4} color="#a3e635" />
          <Scene />
          <Environment preset="city" />
          <ContactShadows position={[0, -1.7, 0]} opacity={0.35} scale={8} blur={2.4} far={3} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null!);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 0.4;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += (target.current.x - group.current.rotation.y) * Math.min(1, dt * 3);
    group.current.rotation.x += (-target.current.y - group.current.rotation.x) * Math.min(1, dt * 3);
  });

  return (
    <group ref={group}>
      {/* Basket */}
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.7}>
        <group position={[0, -0.2, 0]}>
          <RoundedBox args={[2.6, 1.6, 1.8]} radius={0.35} smoothness={6} castShadow receiveShadow>
            <meshStandardMaterial color="#a3e635" roughness={0.35} metalness={0.05} />
          </RoundedBox>
          {/* Handle */}
          <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.95, 0.07, 16, 64, Math.PI]} />
            <meshStandardMaterial color="#1f2937" roughness={0.4} />
          </mesh>
          {/* Brand stripe */}
          <mesh position={[0, -0.1, 0.91]}>
            <planeGeometry args={[2.2, 0.32]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        </group>
      </Float>

      {/* Floating groceries */}
      <Item position={[-2.2, 1.4, 0.6]} color="#ef4444" /> {/* apple */}
      <Item position={[2.3, 1.7, -0.2]} color="#fb923c" size={0.32} /> {/* orange */}
      <Item position={[-2.6, -0.4, -0.8]} color="#fde047" size={0.28} /> {/* lemon */}
      <Item position={[2.6, -0.2, 0.8]} color="#84cc16" size={0.34} /> {/* lime */}
      <Item position={[0.4, 2.3, -0.4]} color="#f9fafb" size={0.38} /> {/* milk */}
      <Item position={[-0.8, 2.1, 0.8]} color="#a16207" size={0.3} /> {/* bread */}
      <Item position={[1.4, -1.5, 0.7]} color="#7c3aed" size={0.3} /> {/* grape */}
      <Item position={[-1.6, -1.6, 0.4]} color="#22c55e" size={0.36} /> {/* veg */}
    </group>
  );
}

function Item({ position, color, size = 0.36 }: { position: [number, number, number]; color: string; size?: number }) {
  return (
    <Float speed={2} rotationIntensity={1.2} floatIntensity={1.6}>
      <Sphere args={[size, 32, 32]} position={position} castShadow>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </Sphere>
    </Float>
  );
}
