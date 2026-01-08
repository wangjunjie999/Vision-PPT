import { useRef, useState, useEffect, Suspense, useImperativeHandle } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Center, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  RotateCcw, 
  Eye, 
  ArrowUp, 
  ArrowRight, 
  Maximize2,
  Loader2,
} from 'lucide-react';

interface Product3DViewerProps {
  modelUrl: string | null;
  imageUrls?: string[];
  onReady?: (ref: { takeScreenshot: () => string | null }) => void;
}

// View presets
const VIEW_PRESETS = {
  isometric: { position: [5, 5, 5] as [number, number, number], name: '等轴测' },
  front: { position: [0, 0, 8] as [number, number, number], name: '正视' },
  side: { position: [8, 0, 0] as [number, number, number], name: '侧视' },
  top: { position: [0, 8, 0] as [number, number, number], name: '俯视' },
};

// Model component
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (modelRef.current) {
      // Center and scale the model
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 4 / maxDim;
      
      modelRef.current.position.sub(center);
      modelRef.current.scale.setScalar(scale);
    }
  }, [scene]);

  return (
    <group ref={modelRef}>
      <primitive object={scene.clone()} />
    </group>
  );
}

// Image plane component for displaying images in 3D
function ImagePlane({ url, index, total }: { url: string; index: number; total: number }) {
  const texture = new THREE.TextureLoader().load(url);
  const angle = (index / total) * Math.PI * 2;
  const radius = 3;
  
  return (
    <mesh 
      position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
      rotation={[0, -angle - Math.PI / 2, 0]}
    >
      <planeGeometry args={[3, 2]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Camera controller component
function CameraController({ 
  viewPreset,
  onControlsReady,
}: { 
  viewPreset: keyof typeof VIEW_PRESETS | null;
  onControlsReady?: (controls: any) => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (viewPreset && controlsRef.current) {
      const preset = VIEW_PRESETS[viewPreset];
      camera.position.set(...preset.position);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [viewPreset, camera]);

  useEffect(() => {
    if (controlsRef.current && onControlsReady) {
      onControlsReady(controlsRef.current);
    }
  }, [onControlsReady]);

  return (
    <OrbitControls 
      ref={controlsRef}
      enableDamping 
      dampingFactor={0.1}
      minDistance={2}
      maxDistance={20}
    />
  );
}

// Screenshot helper component
function ScreenshotHelper({ onReady }: { onReady: (fn: () => string | null) => void }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    });
  }, [gl, scene, camera, onReady]);

  return null;
}

// Loading fallback
function LoadingFallback() {
  return (
    <Html center>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载模型中...</span>
      </div>
    </Html>
  );
}

export function Product3DViewer({ modelUrl, imageUrls = [], onReady }: Product3DViewerProps) {
  const [viewPreset, setViewPreset] = useState<keyof typeof VIEW_PRESETS | null>('isometric');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const screenshotFnRef = useRef<(() => string | null) | null>(null);

  const hasModel = !!modelUrl;
  const hasImages = imageUrls.length > 0;

  // Expose screenshot function to parent
  useEffect(() => {
    if (onReady) {
      onReady({
        takeScreenshot: () => {
          if (screenshotFnRef.current) {
            return screenshotFnRef.current();
          }
          return null;
        },
      });
    }
  }, [onReady]);

  // If only images and no model, show image gallery
  if (!hasModel && hasImages) {
    return (
      <div className="space-y-2">
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <img
            src={imageUrls[currentImageIndex]}
            alt={`产品图片 ${currentImageIndex + 1}`}
            className="w-full h-full object-contain"
          />
          {imageUrls.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {imageUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === currentImageIndex ? "bg-primary" : "bg-primary/30"
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <canvas 
          ref={(canvas) => {
            if (canvas && onReady) {
              const ctx = canvas.getContext('2d');
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
              };
              img.src = imageUrls[currentImageIndex];
              
              onReady({
                takeScreenshot: () => {
                  return canvas.toDataURL('image/png');
                },
              });
            }
          }}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* View Preset Buttons */}
      <div className="flex gap-1 justify-center">
        {(Object.keys(VIEW_PRESETS) as (keyof typeof VIEW_PRESETS)[]).map((key) => (
          <Button
            key={key}
            variant={viewPreset === key ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 px-2"
            onClick={() => setViewPreset(key)}
          >
            {VIEW_PRESETS[key].name}
          </Button>
        ))}
      </div>

      {/* 3D Canvas */}
      <div className="relative aspect-video bg-gradient-to-b from-background to-muted rounded-lg overflow-hidden border">
        <Canvas
          gl={{ preserveDrawingBuffer: true }}
          shadows
          dpr={[1, 2]}
        >
          <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
          <CameraController viewPreset={viewPreset} />
          
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <directionalLight position={[-10, 10, -5]} intensity={0.5} />
          
          <Suspense fallback={<LoadingFallback />}>
            {hasModel && <Model url={modelUrl} />}
            {!hasModel && hasImages && (
              <Center>
                {imageUrls.map((url, i) => (
                  <ImagePlane key={i} url={url} index={i} total={imageUrls.length} />
                ))}
              </Center>
            )}
            <Environment preset="studio" />
          </Suspense>

          <ScreenshotHelper onReady={(fn) => { screenshotFnRef.current = fn; }} />
          
          {/* Grid helper */}
          <gridHelper args={[10, 10, '#666', '#444']} />
        </Canvas>

        {/* Controls hint */}
        <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
          鼠标拖拽旋转 | 滚轮缩放 | 右键平移
        </div>
      </div>
    </div>
  );
}
