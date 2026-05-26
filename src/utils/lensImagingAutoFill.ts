export interface LensImagingAutoFillSource {
  id?: string | null;
  aperture?: string | null;
  max_sensor_size?: string | null;
}

export function getLensImagingAutoFill(lens: LensImagingAutoFillSource | null | undefined) {
  return {
    lensAperture: lens?.aperture?.trim() || '',
    depthOfField: lens?.max_sensor_size?.trim() || '',
  };
}

export function getLensImagingAutoFillKey(lens: LensImagingAutoFillSource | null | undefined) {
  if (!lens) return '';
  return [
    lens.id || '',
    lens.aperture || '',
    lens.max_sensor_size || '',
  ].join('|');
}
