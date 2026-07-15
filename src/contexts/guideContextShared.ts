import { createContext } from 'react';

export type GuideStep = 'welcome' | 'project' | 'workstation' | 'module' | 'complete';

export interface GuideContextType {
  currentStep: GuideStep;
  isGuideActive: boolean;
  showWelcome: boolean;
  dismissGuide: () => void;
  resetGuide: () => void;
  completeStep: (step: GuideStep) => void;
  setShowWelcome: (show: boolean) => void;
}

export const GuideContext = createContext<GuideContextType | undefined>(undefined);
