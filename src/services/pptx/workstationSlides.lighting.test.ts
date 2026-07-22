import { beforeEach, describe, expect, it, vi } from 'vitest';

const imageMocks = vi.hoisted(() => ({
  fetch: vi.fn(async (url: string) => `data:${url}`),
}));

vi.mock('./imagePreloader', () => ({
  fetchImageAsDataUri: imageMocks.fetch,
}));

vi.mock('./imageLayoutUtils', async () => {
  const actual = await vi.importActual<typeof import('./imageLayoutUtils')>('./imageLayoutUtils');
  return {
    ...actual,
    getImageDimensions: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
  };
});

import {
  generateLightingPhotosSlide,
  getLightingPhotoSlideCount,
} from './workstationSlides';

function makeHarness(photoCount: number) {
  const slides: Array<{
    addText: ReturnType<typeof vi.fn>;
    addImage: ReturnType<typeof vi.fn>;
    addShape: ReturnType<typeof vi.fn>;
  }> = [];
  const addSlide = vi.fn(() => {
    const slide = {
      addText: vi.fn(),
      addImage: vi.fn(),
      addShape: vi.fn(),
    };
    slides.push(slide);
    return slide;
  });
  const photos = Array.from({ length: photoCount }, (_, index) => ({
    url: `photo-${index + 1}`,
    remark: `remark-${index + 1}`,
  }));

  return {
    ctx: {
      pptx: { addSlide },
      isZh: true,
      wsCode: 'WS-01',
      wsName: '检测工位',
      responsible: 'Owner',
    },
    data: {
      modules: [{ name: '外观模块', lighting_photos: photos }],
    },
    addSlide,
    slides,
  };
}

describe('lighting photo PPT pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
  ])('creates %i photos as %i slides', async (photoCount, expectedSlides) => {
    const harness = makeHarness(photoCount);

    await generateLightingPhotosSlide(harness.ctx as never, harness.data as never, 0);

    expect(getLightingPhotoSlideCount(photoCount)).toBe(expectedSlides);
    expect(harness.addSlide).toHaveBeenCalledTimes(expectedSlides);
  });

  it('keeps photo order, two-per-page layout, captions, and numbered continuation titles', async () => {
    const harness = makeHarness(5);

    await generateLightingPhotosSlide(harness.ctx as never, harness.data as never, 0);

    expect(harness.slides.map(slide => slide.addImage.mock.calls.length)).toEqual([2, 2, 1]);
    expect(harness.slides.flatMap(slide => slide.addImage.mock.calls.map(call => call[0].data))).toEqual([
      'data:photo-1',
      'data:photo-2',
      'data:photo-3',
      'data:photo-4',
      'data:photo-5',
    ]);
    expect(harness.slides.map(slide => slide.addText.mock.calls[1][0])).toEqual([
      '外观模块 - 打光照片（1/3）',
      '外观模块 - 打光照片（2/3）',
      '外观模块 - 打光照片（3/3）',
    ]);
    expect(harness.slides.flatMap(slide => slide.addText.mock.calls.slice(2).map(call => call[0]))).toEqual([
      'remark-1',
      'remark-2',
      'remark-3',
      'remark-4',
      'remark-5',
    ]);
  });
});
