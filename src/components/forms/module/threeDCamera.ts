import type { ModuleFormState } from './types';

export function strip3DOpticsFromForm<T extends ModuleFormState>(state: T): T {
  return {
    ...state,
    is3DCamera: true,
    selectedLens: '',
    selectedLight: '',
    lightItems: [],
    lightMode: '',
    lightAngle: '',
    lightCount: '',
    lightDistance: '',
    lightDistanceHorizontal: '',
    lightDistanceVertical: '',
    lensAperture: '',
    depthOfField: '',
    workingDistanceTolerance: '',
    lightNote: '',
  };
}

export function needs3DOpticsStrip(state: ModuleFormState) {
  return !state.is3DCamera
    || Boolean(
      state.selectedLens
      || state.selectedLight
      || state.lightItems.length > 0
      || state.lightMode
      || state.lightAngle
      || state.lightCount
      || state.lightDistance
      || state.lightDistanceHorizontal
      || state.lightDistanceVertical
      || state.lensAperture
      || state.depthOfField
      || state.workingDistanceTolerance
      || state.lightNote,
    );
}
