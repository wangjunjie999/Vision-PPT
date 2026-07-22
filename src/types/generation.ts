export type GenerationScope = 'full' | 'workstations' | 'modules';

export interface GenerationSelection {
  scope: GenerationScope;
  selectedWorkstationIds: string[];
  selectedModuleIds: string[];
}
