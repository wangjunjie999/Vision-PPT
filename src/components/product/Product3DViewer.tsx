import { useRef, useState, useEffect, useCallback, Suspense, useMemo, type MutableRefObject } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Html, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getSupportedProductModelHint,
  resolveProductViewerDisplayMode,
  isSupportedProductModelSource,
  type ProductViewerDisplayMode,
} from '@/utils/productViewer';
import {
  captureWebGLFrameToDataUrl,
  DEFAULT_CAPTURE_MAX_EDGE,
  MIN_MEANINGFUL_CAPTURE_DATA_URL_LENGTH,
} from '@/utils/webglFrameCapture';
import { Eye, Loader2 } from 'lucide-react';

export interface Product3DViewerHandle {
  takeScreenshot: () => Promise<string | null>;
  canTakeScreenshot: () => boolean;
  getStatus: () => 'ready' | 'loading' | 'unsupported';
}

interface Product3DViewerProps {
  modelUrl: string | null;
  imageUrls?: string[];
  onReady?: (ref: Product3DViewerHandle) => void;
  fillContainer?: boolean;
  preferredDisplayMode?: ProductViewerDisplayMode;
}

const MODEL_TARGET_SIZE = 6;

const BACKGROUND_PRESETS = {
  light: { hex: '#f3f4f6', name: '浅灰' },
  white: { hex: '#ffffff', name: '白' },
  dark: { hex: '#1f2937', name: '深灰' },
  black: { hex: '#000000', name: '黑' },
} as const;
type BackgroundKey = keyof typeof BACKGROUND_PRESETS;

const TINT_PRESETS: { key: string; hex: string | null; name: string }[] = [
  { key: 'original', hex: null, name: '原色' },
  { key: 'red', hex: '#ef4444', name: '红' },
  { key: 'amber', hex: '#f59e0b', name: '橙' },
  { key: 'green', hex: '#10b981', name: '绿' },
  { key: 'cyan', hex: '#06b6d4', name: '青' },
  { key: 'blue', hex: '#3b82f6', name: '蓝' },
  { key: 'gray', hex: '#9ca3af', name: '灰' },
];

type RenderMode = 'solid' | 'translucent' | 'wireframe';
const RENDER_MODE_PRESETS: { key: RenderMode; name: string }[] = [
  { key: 'solid', name: '实体' },
  { key: 'translucent', name: '半透' },
  { key: 'wireframe', name: '线框' },
];

const VIEW_PRESETS = {
  isometric: { position: [4, 4, 4] as [number, number, number], name: '等轴测' },
  front: { position: [0, 0, 6] as [number, number, number], name: '正视' },
  side: { position: [6, 0, 0] as [number, number, number], name: '侧视' },
  top: { position: [0, 6, 0] as [number, number, number], name: '俯视' },
};

function Model({
  url,
  onLoaded,
  tintHex,
  renderMode,
  partTints,
  paintMode,
  activeBrush,
  onPaintPart,
}: {
  url: string;
  onLoaded?: () => void;
  tintHex: string | null;
  renderMode: RenderMode;
  partTints: Record<string, string>;
  paintMode: 'global' | 'part';
  activeBrush: string | null;
  onPaintPart: (key: string) => void;
}) {
  const { scene: gltfScene } = useGLTF(url, true, true, (loader) => {
    loader.setCrossOrigin('anonymous');
  });
  const modelRef = useRef<THREE.Group>(null);

  // Stable per-mesh key: prefer name, fall back to deterministic path index.
  const meshKeyOf = useCallback((mesh: THREE.Mesh, fallbackIndex: number) => {
    return mesh.name && mesh.name.length > 0 ? `name:${mesh.name}` : `idx:${fallbackIndex}`;
  }, []);

  // Rebuild a fresh display scene from a clean baseline whenever appearance changes.
  // This avoids accumulated state pollution from repeated incremental material mutations.
  const displayScene = useMemo(() => {
    const fresh = SkeletonUtils.clone(gltfScene) as THREE.Object3D;
    let meshIndex = 0;
    fresh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      const partKey = meshKeyOf(child, meshIndex);
      meshIndex += 1;
      // Tag the mesh so pointer events can recover the key.
      child.userData.__partKey = partKey;

      // Determine effective tint for this mesh:
      // - Part mode: only override if this mesh has an entry in partTints
      // - Global mode: apply the global tintHex to every mesh (if any)
      const partOverride = partTints[partKey];
      const effectiveTint = paintMode === 'part' ? partOverride ?? null : tintHex;

      const applyToMaterial = (origMat: THREE.Material): THREE.Material => {
        const mat = origMat.clone();
        const anyMat = mat as THREE.Material & {
          color?: THREE.Color;
          map?: THREE.Texture | null;
          wireframe?: boolean;
          transparent?: boolean;
          opacity?: number;
          needsUpdate?: boolean;
        };

        if (effectiveTint && anyMat.color) {
          anyMat.color = new THREE.Color(effectiveTint);
          if ('map' in anyMat) anyMat.map = null;
        }

        if ('wireframe' in anyMat) {
          anyMat.wireframe = renderMode === 'wireframe';
        }
        if (renderMode === 'translucent') {
          anyMat.transparent = true;
          anyMat.opacity = 0.5;
          anyMat.depthWrite = false as unknown as never;
        }

        anyMat.needsUpdate = true;
        return mat;
      };

      if (Array.isArray(child.material)) {
        child.material = child.material.map(applyToMaterial);
      } else if (child.material) {
        child.material = applyToMaterial(child.material);
      }
    });
    return fresh;
  }, [gltfScene, tintHex, renderMode, partTints, paintMode, meshKeyOf]);

  // Dispose previously cloned materials when displayScene changes / unmounts
  useEffect(() => {
    return () => {
      displayScene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => m && m.dispose());
      });
    };
  }, [displayScene]);

  // Compute fit ONCE per source model.
  useEffect(() => {
    if (!modelRef.current || !gltfScene) return;
    modelRef.current.scale.set(1, 1, 1);
    modelRef.current.position.set(0, 0, 0);
    modelRef.current.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(gltfScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = MODEL_TARGET_SIZE / maxDim;

    modelRef.current.scale.setScalar(scale);
    modelRef.current.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    modelRef.current.updateMatrixWorld(true);
    onLoaded?.();
  }, [gltfScene, onLoaded]);

  const handlePointerDown = useCallback(
    (e: any) => {
      if (paintMode !== 'part' || !activeBrush) return;
      const obj = e.object as THREE.Object3D | undefined;
      if (!obj || !(obj instanceof THREE.Mesh)) return;
      const key = obj.userData?.__partKey as string | undefined;
      if (!key) return;
      e.stopPropagation();
      onPaintPart(key);
    },
    [paintMode, activeBrush, onPaintPart]
  );

  return (
    <group ref={modelRef} onPointerDown={handlePointerDown}>
      <primitive object={displayScene} />
    </group>
  );
}

function ImagePlane({ url, index, total }: { url: string; index: number; total: number }) {
  const [map, setMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    let cancelled = false;
    let current: THREE.Texture | null = null;
    loader.load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        current = tex;
        setMap(tex);
      },
      undefined,
      () => {
        if (!cancelled) setMap(null);
      }
    );
    return () => {
      cancelled = true;
      current?.dispose();
      setMap(null);
    };
  }, [url]);

  const angle = (index / total) * Math.PI * 2;
  const radius = 3;

  if (!map) return null;

  return (
    <mesh
      position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
      rotation={[0, -angle - Math.PI / 2, 0]}
    >
      <planeGeometry args={[3, 2]} />
      <meshBasicMaterial map={map} side={THREE.DoubleSide} />
    </mesh>
  );
}

function CameraController({
  viewPreset,
  controlsRef,
}: {
  viewPreset: keyof typeof VIEW_PRESETS | null;
  controlsRef: MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); } };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (viewPreset && controlsRef.current) {
      const preset = VIEW_PRESETS[viewPreset];
      camera.position.set(...preset.position);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [viewPreset, camera, controlsRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={1.2}
      maxDistance={20}
      mouseButtons={{
        LEFT: spaceHeld ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: undefined as any,
      }}
    />
  );
}

function ScreenshotHelper({
  onReady,
  controlsRef,
}: {
  onReady: (fn: () => Promise<string | null>) => void;
  controlsRef: MutableRefObject<any>;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    onReady(async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const dataUrl = captureWebGLFrameToDataUrl(gl, scene, camera, {
          maxEdge: DEFAULT_CAPTURE_MAX_EDGE,
          beforeRender: () => {
            controlsRef.current?.update?.();
          },
        });

        if (dataUrl && dataUrl.length > MIN_MEANINGFUL_CAPTURE_DATA_URL_LENGTH) {
          return dataUrl;
        }
      }

      console.warn('Screenshot capture did not produce a usable PNG data URL.');
      return null;
    });
  }, [gl, scene, camera, onReady, controlsRef]);

  return null;
}

function RenderReadyTracker({
  enabled,
  onSettled,
}: {
  enabled: boolean;
  onSettled: () => void;
}) {
  const frameCountRef = useRef(0);
  const notifiedRef = useRef(false);

  useEffect(() => {
    frameCountRef.current = 0;
    notifiedRef.current = false;
  }, [enabled]);

  useFrame(() => {
    if (!enabled || notifiedRef.current) return;

    frameCountRef.current += 1;
    if (frameCountRef.current >= 3) {
      notifiedRef.current = true;
      onSettled();
    }
  });

  return null;
}

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

function BackgroundSync({ hex }: { hex: string }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.setClearColor(hex, 1);
    scene.background = new THREE.Color(hex);
  }, [gl, scene, hex]);
  return null;
}

type CanvasInnerProps = {
  viewPreset: keyof typeof VIEW_PRESETS | null;
  isModelMode: boolean;
  hasSupportedModel: boolean;
  modelUrl: string | null;
  hasModel: boolean;
  hasImages: boolean;
  imageUrls: string[];
  modelMounted: boolean;
  setModelMounted: (v: boolean) => void;
  setModelLoaded: () => void;
  registerScreenshot: (fn: () => Promise<string | null>) => void;
  tintHex: string | null;
  renderMode: RenderMode;
  backgroundHex: string;
  partTints: Record<string, string>;
  paintMode: 'global' | 'part';
  activeBrush: string | null;
  onPaintPart: (key: string) => void;
};

function ProductViewerCanvasInner({
  viewPreset,
  isModelMode,
  hasSupportedModel,
  modelUrl,
  hasModel,
  hasImages,
  imageUrls,
  modelMounted,
  setModelMounted,
  setModelLoaded,
  registerScreenshot,
  tintHex,
  renderMode,
  backgroundHex,
  partTints,
  paintMode,
  activeBrush,
  onPaintPart,
}: CanvasInnerProps) {
  const controlsRef = useRef<any>(null);

  return (
    <>
      <BackgroundSync hex={backgroundHex} />
      <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
      <CameraController viewPreset={viewPreset} controlsRef={controlsRef} />

      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
      <directionalLight position={[0, -8, 0]} intensity={0.3} />
      <directionalLight position={[0, 2, 10]} intensity={0.4} />
      <directionalLight position={[0, 2, -10]} intensity={0.3} />

      <Suspense fallback={<LoadingFallback />}>
        {isModelMode && hasSupportedModel && modelUrl && (
          <Model
            url={modelUrl}
            onLoaded={() => setModelMounted(true)}
            tintHex={tintHex}
            renderMode={renderMode}
            partTints={partTints}
            paintMode={paintMode}
            activeBrush={activeBrush}
            onPaintPart={onPaintPart}
          />
        )}
        {!hasModel && hasImages && (
          <Center>
            {imageUrls.map((url, i) => (
              <ImagePlane key={i} url={url} index={i} total={imageUrls.length} />
            ))}
          </Center>
        )}
        <Environment preset="studio" />
      </Suspense>

      <RenderReadyTracker
        enabled={isModelMode && hasSupportedModel && modelMounted}
        onSettled={setModelLoaded}
      />

      <ScreenshotHelper onReady={registerScreenshot} controlsRef={controlsRef} />
    </>
  );
}

export function Product3DViewer({
  modelUrl,
  imageUrls = [],
  onReady,
  fillContainer,
  preferredDisplayMode = 'auto',
}: Product3DViewerProps) {
  const [viewPreset, setViewPreset] = useState<keyof typeof VIEW_PRESETS | null>('isometric');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const screenshotFnRef = useRef<(() => Promise<string | null>) | null>(null);
  const [modelMounted, setModelMounted] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tintKey, setTintKey] = useState<string>('original');
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [backgroundKey, setBackgroundKey] = useState<BackgroundKey>('light');
  const [paintMode, setPaintMode] = useState<'global' | 'part'>('global');
  const [partTints, setPartTints] = useState<Record<string, string>>({});
  const [activeBrush, setActiveBrush] = useState<string | null>(null);

  const tintHex = TINT_PRESETS.find((t) => t.key === tintKey)?.hex ?? null;
  const backgroundHex = BACKGROUND_PRESETS[backgroundKey].hex;

  const handlePaintPart = useCallback((key: string) => {
    setPartTints((prev) => {
      if (!activeBrush) return prev;
      return { ...prev, [key]: activeBrush };
    });
  }, [activeBrush]);

  const clearPartTints = useCallback(() => setPartTints({}), []);

  const hasModel = !!modelUrl;
  const hasImages = imageUrls.length > 0;
  const hasSupportedModel = !!modelUrl && isSupportedProductModelSource(modelUrl);
  const displayMode = resolveProductViewerDisplayMode(preferredDisplayMode, modelUrl, imageUrls);
  const isImageMode = displayMode === 'image';
  const isModelMode = displayMode === 'model';
  const canCapture3D = hasSupportedModel && modelLoaded && !!screenshotFnRef.current;

  const registerScreenshot = useCallback((fn: () => Promise<string | null>) => {
    screenshotFnRef.current = fn;
  }, []);

  const markModelLoaded = useCallback(() => {
    setModelLoaded(true);
  }, []);

  useEffect(() => {
    setModelMounted(false);
    setModelLoaded(false);
  }, [modelUrl]);

  useEffect(() => {
    setImageLoaded(false);
  }, [currentImageIndex, imageUrls]);

  useEffect(() => {
    if (!onReady) return;
    onReady({
      takeScreenshot: async () => {
        if (isImageMode) {
          return imageLoaded ? imageUrls[currentImageIndex] || null : null;
        }

        if (!canCapture3D || !screenshotFnRef.current) {
          return null;
        }

        try {
          return await screenshotFnRef.current();
        } catch (e) {
          console.warn('3D screenshot failed:', e);
          return null;
        }
      },
      canTakeScreenshot: () => {
        if (isImageMode) {
          return imageLoaded && !!imageUrls[currentImageIndex];
        }
        return canCapture3D;
      },
      getStatus: () => {
        if (isImageMode) {
          return imageLoaded ? 'ready' : 'loading';
        }

        if (hasModel && !hasSupportedModel) {
          return 'unsupported';
        }

        return canCapture3D ? 'ready' : 'loading';
      },
    });
  }, [
    onReady,
    hasModel,
    hasSupportedModel,
    isImageMode,
    imageLoaded,
    currentImageIndex,
    imageUrls,
    canCapture3D,
  ]);

  if (isImageMode) {
    return (
      <div className={fillContainer ? 'h-full w-full flex items-center justify-center bg-muted' : 'space-y-2'}>
        <div className={cn(
          'relative overflow-hidden',
          fillContainer ? 'h-full w-full flex items-center justify-center' : 'aspect-video bg-muted rounded-lg'
        )}>
          <img
            src={imageUrls[currentImageIndex]}
            alt={`产品图片 ${currentImageIndex + 1}`}
            className={fillContainer ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-contain'}
            onLoad={() => setImageLoaded(true)}
          />
          {imageUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {imageUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-colors',
                    i === currentImageIndex ? 'bg-primary' : 'bg-primary/30'
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isImageMode && hasModel && !hasSupportedModel) {
    return (
      <div className={fillContainer ? 'h-full w-full flex items-center justify-center bg-muted' : 'rounded-lg border bg-muted p-6'}>
        <div className="text-center text-muted-foreground space-y-2">
          <Eye className="h-8 w-8 mx-auto opacity-50" />
          <p className="text-sm">{getSupportedProductModelHint()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={fillContainer ? 'h-full w-full flex flex-col' : 'space-y-2'}>
      <div className={cn('flex flex-col gap-1.5', fillContainer ? 'py-2 px-2 shrink-0' : '')}>
        {/* Row 1: View presets */}
        <div className="flex gap-1 justify-center flex-wrap">
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

        {/* Row 2: Appearance controls (only meaningful for 3D model mode) */}
        {isModelMode && hasSupportedModel && (
          <div className="flex gap-3 justify-center flex-wrap items-center text-xs">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">背景</span>
              {(Object.keys(BACKGROUND_PRESETS) as BackgroundKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBackgroundKey(key)}
                  title={BACKGROUND_PRESETS[key].name}
                  className={cn(
                    'h-5 w-5 rounded border transition-all',
                    backgroundKey === key ? 'ring-2 ring-primary ring-offset-1' : 'border-border'
                  )}
                  style={{ background: BACKGROUND_PRESETS[key].hex }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">染色</span>
              {TINT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setTintKey(preset.key)}
                  title={preset.name}
                  className={cn(
                    'h-5 w-5 rounded border transition-all flex items-center justify-center',
                    tintKey === preset.key ? 'ring-2 ring-primary ring-offset-1' : 'border-border'
                  )}
                  style={{ background: preset.hex ?? 'transparent' }}
                >
                  {!preset.hex && <span className="text-[9px] text-muted-foreground">原</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">模式</span>
              {RENDER_MODE_PRESETS.map((m) => (
                <Button
                  key={m.key}
                  variant={renderMode === m.key ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setRenderMode(m.key)}
                >
                  {m.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Paint mode (part-by-part coloring) */}
        {isModelMode && hasSupportedModel && (
          <div className="flex gap-3 justify-center flex-wrap items-center text-xs">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">染色模式</span>
              <Button
                variant={paintMode === 'global' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => { setPaintMode('global'); setActiveBrush(null); }}
              >
                整体
              </Button>
              <Button
                variant={paintMode === 'part' ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setPaintMode('part')}
              >
                局部
              </Button>
            </div>
            {paintMode === 'part' && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">画笔</span>
                  {TINT_PRESETS.filter((p) => p.hex).map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setActiveBrush(preset.hex)}
                      title={preset.name}
                      className={cn(
                        'h-5 w-5 rounded border transition-all',
                        activeBrush === preset.hex ? 'ring-2 ring-primary ring-offset-1' : 'border-border'
                      )}
                      style={{ background: preset.hex ?? 'transparent' }}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={clearPartTints}
                  disabled={Object.keys(partTints).length === 0}
                >
                  清空局部染色
                </Button>
                <span className="text-muted-foreground">
                  {activeBrush ? '点击模型零件上色' : '请先选择画笔颜色'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          'relative bg-gradient-to-b from-background to-muted overflow-hidden border',
          fillContainer ? 'flex-1 min-h-0' : 'aspect-video rounded-lg'
        )}
      >
        <Canvas
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          shadows
          dpr={Math.min(window.devicePixelRatio || 1, 2)}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(backgroundHex, 1);
            scene.background = new THREE.Color(backgroundHex);
          }}
        >
          <ProductViewerCanvasInner
            viewPreset={viewPreset}
            isModelMode={isModelMode}
            hasSupportedModel={hasSupportedModel}
            modelUrl={modelUrl}
            hasModel={hasModel}
            hasImages={hasImages}
            imageUrls={imageUrls}
            modelMounted={modelMounted}
            setModelMounted={setModelMounted}
            setModelLoaded={markModelLoaded}
            registerScreenshot={registerScreenshot}
            tintHex={tintHex}
            renderMode={renderMode}
            backgroundHex={backgroundHex}
          />
        </Canvas>

        <div
          data-capture-ignore="true"
          className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded"
        >
          鼠标拖拽旋转 | 滚轮缩放 | 空格+拖拽平移
        </div>
      </div>
    </div>
  );
}
