import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FiscalModule } from '@/types/fiscal';

interface ModuleContextType {
  activeModule: FiscalModule;
  setActiveModule: (module: FiscalModule) => void;
  getModulePath: (path: string) => string;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModuleState] = useState<FiscalModule>(() =>
    (localStorage.getItem('portal-fiscal-active-module') as FiscalModule | null) || 'nfe');

  const setActiveModule = useCallback((module: FiscalModule) => {
    setActiveModuleState(module);
    localStorage.setItem('portal-fiscal-active-module', module);
  }, []);

  const getModulePath = useCallback((path: string) => {
    return path;
  }, []);

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule, getModulePath }}>
      {children}
    </ModuleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModule() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within ModuleProvider');
  }
  return context;
}
