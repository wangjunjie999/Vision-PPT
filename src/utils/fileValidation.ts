/**
 * File validation utilities with magic byte verification
 * Provides defense-in-depth validation for file uploads
 */

import { toast } from 'sonner';

// Magic byte signatures for common image formats
const FILE_SIGNATURES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header for WebP
  gif: [0x47, 0x49, 0x46], // GIF header
} as const;

// WebP has additional check after RIFF header
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
  checkMagicBytes?: boolean;
}

const DEFAULT_IMAGE_OPTIONS: FileValidationOptions = {
  maxSizeMB: 5,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  checkMagicBytes: true,
};

/**
 * Validates file extension
 */
function validateExtension(fileName: string, allowedExtensions: string[]): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

/**
 * Validates MIME type
 */
function validateMimeType(mimeType: string, allowedMimeTypes: string[]): boolean {
  return allowedMimeTypes.includes(mimeType);
}

/**
 * Validates file size
 */
function validateFileSize(fileSize: number, maxSizeMB: number): boolean {
  return fileSize <= maxSizeMB * 1024 * 1024;
}

/**
 * Reads first bytes of file and checks against known signatures
 */
async function validateMagicBytes(file: File): Promise<boolean> {
  try {
    // Read first 12 bytes for WebP detection (RIFF + size + WEBP)
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check JPEG signature
    if (
      bytes[0] === FILE_SIGNATURES.jpeg[0] &&
      bytes[1] === FILE_SIGNATURES.jpeg[1] &&
      bytes[2] === FILE_SIGNATURES.jpeg[2]
    ) {
      return true;
    }

    // Check PNG signature
    if (
      bytes[0] === FILE_SIGNATURES.png[0] &&
      bytes[1] === FILE_SIGNATURES.png[1] &&
      bytes[2] === FILE_SIGNATURES.png[2] &&
      bytes[3] === FILE_SIGNATURES.png[3]
    ) {
      return true;
    }

    // Check WebP signature (RIFF header + WEBP at offset 8)
    if (
      bytes[0] === FILE_SIGNATURES.webp[0] &&
      bytes[1] === FILE_SIGNATURES.webp[1] &&
      bytes[2] === FILE_SIGNATURES.webp[2] &&
      bytes[3] === FILE_SIGNATURES.webp[3] &&
      bytes[8] === WEBP_SIGNATURE[0] &&
      bytes[9] === WEBP_SIGNATURE[1] &&
      bytes[10] === WEBP_SIGNATURE[2] &&
      bytes[11] === WEBP_SIGNATURE[3]
    ) {
      return true;
    }

    // Check GIF signature
    if (
      bytes[0] === FILE_SIGNATURES.gif[0] &&
      bytes[1] === FILE_SIGNATURES.gif[1] &&
      bytes[2] === FILE_SIGNATURES.gif[2]
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error reading file bytes:', error);
    return false;
  }
}

/**
 * Comprehensive image file validation
 * Returns true if valid, false otherwise
 * Shows toast error messages for invalid files
 */
export async function validateImageFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };

  // 1. Check extension
  if (opts.allowedExtensions && !validateExtension(file.name, opts.allowedExtensions)) {
    toast.error(`仅支持 ${opts.allowedExtensions.join(', ').toUpperCase()} 格式`);
    return false;
  }

  // 2. Check MIME type
  if (opts.allowedMimeTypes && !validateMimeType(file.type, opts.allowedMimeTypes)) {
    toast.error('无效的图片格式');
    return false;
  }

  // 3. Check file size
  if (opts.maxSizeMB && !validateFileSize(file.size, opts.maxSizeMB)) {
    toast.error(`图片大小不能超过 ${opts.maxSizeMB}MB`);
    return false;
  }

  // 4. Verify magic bytes (optional but recommended)
  if (opts.checkMagicBytes) {
    const validBytes = await validateMagicBytes(file);
    if (!validBytes) {
      toast.error('文件内容与扩展名不匹配');
      return false;
    }
  }

  return true;
}

/**
 * Validates 3D model files
 */
export async function validate3DModelFile(
  file: File,
  maxSizeMB: number = 50
): Promise<boolean> {
  const allowedExtensions = ['glb', 'gltf', 'obj', 'fbx'];
  const allowedMimeTypes = [
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream',
  ];

  // Check extension
  if (!validateExtension(file.name, allowedExtensions)) {
    toast.error(`仅支持 ${allowedExtensions.join(', ').toUpperCase()} 格式`);
    return false;
  }

  // Check file size
  if (!validateFileSize(file.size, maxSizeMB)) {
    toast.error(`模型文件大小不能超过 ${maxSizeMB}MB`);
    return false;
  }

  // For 3D models, we check MIME type but are more lenient
  // since browsers often report application/octet-stream
  if (file.type && !allowedMimeTypes.includes(file.type) && !file.type.startsWith('model/')) {
    // Just warn, don't reject - server will validate
    console.warn('Unusual MIME type for 3D model:', file.type);
  }

  return true;
}
