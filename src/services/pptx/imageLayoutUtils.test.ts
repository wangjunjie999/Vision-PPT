import { describe, expect, it } from 'vitest';
import { calculateContainFit, calculateWhitespaceTrimBounds, type RasterImageData } from './imageLayoutUtils';

function createRaster(width: number, height: number, fill: [number, number, number, number] = [255, 255, 255, 255]): RasterImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];
  }
  return { width, height, data };
}

function fillRect(
  image: RasterImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number, number],
) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const index = (yy * image.width + xx) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = color[3];
    }
  }
}

describe('imageLayoutUtils whitespace trimming', () => {
  it('calculates a smaller crop box for white margins', () => {
    const image = createRaster(100, 80);
    fillRect(image, 30, 20, 40, 40, [20, 20, 20, 255]);

    const bounds = calculateWhitespaceTrimBounds(image, { paddingPx: 5, threshold: 24 });

    expect(bounds).toEqual({ x: 25, y: 15, width: 50, height: 50 });
  });

  it('does not crop when the content is already close to full frame', () => {
    const image = createRaster(100, 80);
    fillRect(image, 1, 1, 98, 78, [30, 30, 30, 255]);

    expect(calculateWhitespaceTrimBounds(image, { paddingPx: 5, threshold: 24 })).toBeNull();
  });

  it('returns no crop for blank white images', () => {
    const image = createRaster(100, 80);

    expect(calculateWhitespaceTrimBounds(image)).toBeNull();
  });

  it('keeps the trimmed image proportional when fitting into the PPT area', () => {
    const image = createRaster(100, 80);
    fillRect(image, 30, 20, 40, 40, [20, 20, 20, 255]);
    const bounds = calculateWhitespaceTrimBounds(image, { paddingPx: 5, threshold: 24 });

    expect(bounds).not.toBeNull();
    const fit = calculateContainFit(bounds!.width, bounds!.height, { x: 0.4, y: 1.45, width: 4.6, height: 3.45 });

    expect(fit.width).toBeLessThanOrEqual(4.6);
    expect(fit.height).toBeLessThanOrEqual(3.45);
    expect(Math.round((fit.width / fit.height) * 1000) / 1000).toBe(1);
  });
});
