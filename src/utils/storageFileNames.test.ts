import { describe, expect, it } from 'vitest';
import {
  createSafeStorageObjectName,
  getSafeFileExtension,
  sanitizeStorageSegment,
} from './storageFileNames';

describe('storageFileNames', () => {
  it('extracts extensions from Chinese file names', () => {
    expect(getSafeFileExtension('测试图片.png')).toBe('png');
    expect(getSafeFileExtension('模型 中文.glb')).toBe('glb');
  });

  it('sanitizes storage path segments to ASCII-safe values', () => {
    expect(sanitizeStorageSegment('测试 image 01.png', 'file')).toBe('image-01.png');
    expect(sanitizeStorageSegment('测试', 'file')).toBe('file');
  });

  it('creates an ASCII-safe object name for Chinese file names', () => {
    const objectName = createSafeStorageObjectName('模型 中文.glb', {
      fallbackBase: 'model',
      timestamp: 123,
      randomSuffix: 'abc123',
    });

    expect(objectName).toBe('123-abc123-model.glb');
    expect(objectName).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('uses fallbacks for names without usable basename or extension', () => {
    expect(createSafeStorageObjectName('测试', {
      fallbackBase: 'upload',
      fallbackExtension: 'bin',
      timestamp: 1,
      randomSuffix: 'r',
    })).toBe('1-r-upload.bin');
  });
});
