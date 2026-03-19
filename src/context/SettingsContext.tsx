import React, { createContext, useContext, useState, useCallback } from 'react';
import { AppSettings, BaudRate, ErrorCorrectionMode } from '../types';
import { ProtocolConfig } from '../constants/ProtocolConfig';

const DEFAULT_SETTINGS: AppSettings = {
  baudRate: ProtocolConfig.DEFAULT_BAUD_RATE as BaudRate,
  markFreq: ProtocolConfig.MARK_FREQ,
  spaceFreq: ProtocolConfig.SPACE_FREQ,
  errorCorrection: 'none',
  volumeBoost: false,
  debugMode: false,
  encryptionEnabled: false,
  encryptionPassphrase: '',
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  return useContext(SettingsContext);
}
