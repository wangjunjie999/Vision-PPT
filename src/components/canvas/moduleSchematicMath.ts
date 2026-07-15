export function getLightYForDistance(lightDistanceMm: number, distanceScale: number, productY: number) {
  return Math.max(24, Math.min(620, productY - (lightDistanceMm / distanceScale)));
}

export function getLightVerticalDistanceForY(lightY: number, distanceScale: number, productY: number) {
  return Math.round((productY - lightY) * distanceScale);
}
