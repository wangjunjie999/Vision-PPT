import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Center } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';

interface Model3DViewerProps {
  modelUrl: string;
  sourceType: 'glb' | 'gltf' | 'stl';
  onCameraChange?: (position: [number, number, number], rotation: [number, number, number]) => void;
}

function GLBModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return (
    <Center>
      <primitive object={gltf.scene} scale={1} />
    </Center>
  );
}

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  
  useEffect(() => {
    geometry.center();
    geometry.computeVertexNormals();
  }, [geometry]);

  return (
    <Center>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#888888" metalness={0.3} roughness={0.6} />
      </mesh>
    </Center>
  );
}

function CameraController({ onCameraChange }: { onCameraChange?: Model3DViewerProps['onCameraChange'] }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const handleChange = () => {
      if (onCameraChange) {
        const pos = camera.position.toArray() as [number, number, number];
        const rot = camera.rotation.toArray().slice(0, 3) as [number, number, number];
        onCameraChange(pos, rot);
      }
    };

    const controls = controlsRef.current;
    if (controls) {
      controls.addEventListener('change', handleChange);
      return () => controls.removeEventListener('change', handleChange);
    }
  }, [camera, onCameraChange]);

  return <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate />;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#666666" wireframe />
    </mesh>
  );
}

export function Model3DViewer({ modelUrl, sourceType, onCameraChange }: Model3DViewerProps) {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-lg">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-b from-muted/20 to-muted/40 rounded-lg overflow-hidden">
      <Canvas>
        <PerspectiveCamera makeDefault position={[3, 3, 3]} />
        <CameraController onCameraChange={onCameraChange} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        
        <Suspense fallback={<LoadingFallback />}>
          {(sourceType === 'glb' || sourceType === 'gltf') && (
            <GLBModel url={modelUrl} />
          )}
          {sourceType === 'stl' && (
            <STLModel url={modelUrl} />
          )}
        </Suspense>
        
        <gridHelper args={[10, 10, '#444444', '#222222']} />
      </Canvas>
    </div>
  );
}
