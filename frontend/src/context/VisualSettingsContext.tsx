import React, { createContext, useContext, useState, useEffect } from 'react';

interface VisualSettings {
  showNoise: boolean;
  showParticles: boolean;
  highPerformance: boolean;
}

interface VisualSettingsContextType {
  settings: VisualSettings;
  toggleNoise: () => void;
  toggleParticles: () => void;
  togglePerformance: () => void;
}

const VisualSettingsContext = createContext<VisualSettingsContextType | undefined>(undefined);

export const VisualSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<VisualSettings>(() => {
    const saved = localStorage.getItem('neural_visual_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse visual settings', e);
      }
    }
    return {
      showNoise: false,
      showParticles: true,
      highPerformance: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('neural_visual_settings', JSON.stringify(settings));
  }, [settings]);

  const toggleNoise = () => {
    setSettings(prev => ({ ...prev, showNoise: !prev.showNoise }));
  };

  const toggleParticles = () => {
    setSettings(prev => ({ ...prev, showParticles: !prev.showParticles }));
  };

  const togglePerformance = () => {
    setSettings(prev => ({ ...prev, highPerformance: !prev.highPerformance }));
  };

  return (
    <VisualSettingsContext.Provider value={{ settings, toggleNoise, toggleParticles, togglePerformance }}>
      {children}
    </VisualSettingsContext.Provider>
  );
};

export const useVisualSettings = () => {
  const context = useContext(VisualSettingsContext);
  if (context === undefined) {
    throw new Error('useVisualSettings must be used within a VisualSettingsProvider');
  }
  return context;
};
