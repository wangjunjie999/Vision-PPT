/**
 * GLB Exporter Utility
 * Exports Three.js Object3D to .glb binary format and triggers download
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * Export a Three.js scene/group to GLB binary and trigger browser download
 */
export async function exportToGLB(
  object: THREE.Object3D,
  filename: string = 'model.glb'
): Promise<Blob> {
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], {
          type: 'application/octet-stream',
        });
        resolve(blob);
      },
      (error) => {
        reject(error);
      },
      { binary: true }
    );
  });
}

/**
 * Download a Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Object3D to GLB and download
 */
export async function exportAndDownloadGLB(
  object: THREE.Object3D,
  filename: string = 'robot-arm.glb'
): Promise<void> {
  const blob = await exportToGLB(object, filename);
  downloadBlob(blob, filename);
}
