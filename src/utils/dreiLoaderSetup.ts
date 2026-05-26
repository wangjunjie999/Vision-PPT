/**
 * 全局配置 drei/three 的 Draco 与 KTX2 解码器路径为本地 /decoders/
 * 避免默认从 google gstatic CDN 拉取在国内/内网环境失败。
 *
 * 在 main.tsx 中尽早 import 一次即可生效，
 * 之后所有 useGLTF / GLTFLoader 调用都会自动复用本地解码器。
 */
import { useGLTF } from '@react-three/drei';

// drei 的 useGLTF 暴露了 setDecoderPath / setMeshoptDecoder 等静态方法
try {
  // Draco 解码器
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (useGLTF as any).setDecoderPath?.('/decoders/draco/');
} catch (e) {
  console.warn('[dreiLoaderSetup] setDecoderPath failed', e);
}

export {};
