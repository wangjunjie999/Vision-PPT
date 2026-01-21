import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from './DataContext';

export type GuideStep = 'welcome' | 'project' | 'workstation' | 'module' | 'complete';

interface GuideContextType {
  currentStep: GuideStep;
  isGuideActive: boolean;
  showWelcome: boolean;
  dismissGuide: () => void;
  resetGuide: () => void;
  completeStep: (step: GuideStep) => void;
  setShowWelcome: (show: boolean) => void;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

const STORAGE_KEY = 'vision-guide-state';

interface StoredGuideState {
  dismissed: boolean;
  completedSteps: GuideStep[];
  welcomeShown: boolean;
}

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const { projects, workstations, modules } = useData();
  
  const [dismissed, setDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<GuideStep[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: StoredGuideState = JSON.parse(stored);
        setDismissed(state.dismissed);
        setCompletedSteps(state.completedSteps || []);
        // Show welcome only if never shown before
        if (!state.welcomeShown && !state.dismissed) {
          setShowWelcome(true);
        }
      } else {
        // First time user - show welcome
        setShowWelcome(true);
      }
    } catch (e) {
      console.error('Failed to load guide state:', e);
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    try {
      const state: StoredGuideState = {
        dismissed,
        completedSteps,
        welcomeShown: !showWelcome || completedSteps.length > 0,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save guide state:', e);
    }
  }, [dismissed, completedSteps, showWelcome]);

  // Calculate current step based on data state
  const currentStep = useMemo((): GuideStep => {
    if (showWelcome) return 'welcome';
    if (!projects || projects.length === 0) return 'project';
    if (!workstations || workstations.length === 0) return 'workstation';
    if (!modules || modules.length === 0) return 'module';
    return 'complete';
  }, [projects, workstations, modules, showWelcome]);

  const isGuideActive = !dismissed;

  const dismissGuide = useCallback(() => {
    setDismissed(true);
    setShowWelcome(false);
  }, []);

  const resetGuide = useCallback(() => {
    setDismissed(false);
    setCompletedSteps([]);
    setShowWelcome(true);
  }, []);

  const completeStep = useCallback((step: GuideStep) => {
    setCompletedSteps(prev => {
      if (prev.includes(step)) return prev;
      return [...prev, step];
    });
    if (step === 'welcome') {
      setShowWelcome(false);
    }
  }, []);

  const value = useMemo(() => ({
    currentStep,
    isGuideActive,
    showWelcome,
    dismissGuide,
    resetGuide,
    completeStep,
    setShowWelcome,
  }), [currentStep, isGuideActive, showWelcome, dismissGuide, resetGuide, completeStep]);

  return (
    <GuideContext.Provider value={value}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const context = useContext(GuideContext);
  if (context === undefined) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
}
