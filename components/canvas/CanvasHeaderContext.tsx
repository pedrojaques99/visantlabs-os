import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface CanvasHeaderContextValue {
  projectName?: string;
  setProjectName: (name: string) => void;
  selectedNodesCount: number;
  setSelectedNodesCount: (count: number) => void;
  // Project sharing data
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  shareId: string | null;
  setShareId: (id: string | null) => void;
  isCollaborative: boolean;
  setIsCollaborative: (value: boolean) => void;
  canEdit: string[];
  setCanEdit: (users: string[]) => void;
  canView: string[];
  setCanView: (users: string[]) => void;
  othersCount: number;
  setOthersCount: (value: number) => void;
  // Canvas settings
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  gridColor: string;
  setGridColor: (color: string) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showMinimap: boolean;
  setShowMinimap: (show: boolean) => void;
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  cursorColor: string;
  setCursorColor: (color: string) => void;
  brandCyan: string;
  setBrandCyan: (color: string) => void;
  experimentalMode: boolean;
  setExperimentalMode: (value: boolean) => void;
  onImportCommunityPreset?: (preset: any, type: string) => void;
  setOnImportCommunityPreset: (handler: ((preset: any, type: string) => void) | undefined) => void;
  onProjectNameChange?: (name: string) => void;
  setOnProjectNameChange: (handler: ((name: string) => void) | undefined) => void;
}

const CanvasHeaderContext = createContext<CanvasHeaderContextValue | null>(null);

export const useCanvasHeader = () => {
  const context = useContext(CanvasHeaderContext);
  if (!context) {
    throw new Error('useCanvasHeader must be used within CanvasHeaderProvider');
  }
  return context;
};

// Helper hook for localStorage
const useLocalStorage = <T,>(key: string, defaultValue: T): [T, (value: T) => void] => {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    if (typeof defaultValue === 'boolean') return (item === 'true') as T;
    if (typeof defaultValue === 'string') return item as T;
    return defaultValue;
  });

  const setValue = useCallback((value: T) => {
    setState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, String(value));
    }
  }, [key]);

  return [state, setValue];
};

interface CanvasHeaderProviderProps {
  children: React.ReactNode;
}

export const CanvasHeaderProvider: React.FC<CanvasHeaderProviderProps> = ({ children }) => {
  const [projectName, setProjectNameState] = useState<string>('');
  const [selectedNodesCount, setSelectedNodesCount] = useState<number>(0);
  // Project sharing state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [canEdit, setCanEdit] = useState<string[]>([]);
  const [canView, setCanView] = useState<string[]>([]);
  const [othersCount, setOthersCount] = useState(0);
  const [onImportCommunityPreset, setOnImportCommunityPreset] = useState<((preset: any, type: string) => void) | undefined>(undefined);
  const [onProjectNameChange, setOnProjectNameChange] = useState<((name: string) => void) | undefined>(undefined);

  const [backgroundColor, setBackgroundColor] = useLocalStorage('canvasBackgroundColor', '#121212');
  const [gridColor, setGridColor] = useLocalStorage('canvasGridColor', 'rgba(255, 255, 255, 0.1)');
  const [showGrid, setShowGrid] = useLocalStorage('canvasShowGrid', true);
  const [showMinimap, setShowMinimap] = useLocalStorage('canvasShowMinimap', true);
  const [showControls, setShowControls] = useLocalStorage('canvasShowControls', true);
  const [cursorColor, setCursorColor] = useLocalStorage('canvasCursorColor', '#FFFFFF');
  const [brandCyan, setBrandCyan] = useLocalStorage('canvasBrandCyan', '#52ddeb');
  const [experimentalMode, setExperimentalMode] = useLocalStorage('canvasExperimentalMode', false);

  const setProjectName = useCallback((name: string) => {
    setProjectNameState(name && typeof name === 'string' ? name : '');
  }, []);

  const value: CanvasHeaderContextValue = useMemo(() => ({
    projectName,
    setProjectName,
    selectedNodesCount,
    setSelectedNodesCount,
    projectId,
    setProjectId,
    shareId,
    setShareId,
    isCollaborative,
    setIsCollaborative,
    canEdit,
    setCanEdit,
    canView,
    setCanView,
    othersCount,
    setOthersCount,
    backgroundColor,
    setBackgroundColor,
    gridColor,
    setGridColor,
    showGrid,
    setShowGrid,
    showMinimap,
    setShowMinimap,
    showControls,
    setShowControls,
    cursorColor,
    setCursorColor,
    brandCyan,
    setBrandCyan,
    experimentalMode,
    setExperimentalMode,
    onImportCommunityPreset,
    setOnImportCommunityPreset,
    onProjectNameChange,
    setOnProjectNameChange,
  }), [
    projectName,
    selectedNodesCount,
    projectId,
    shareId,
    isCollaborative,
    canEdit,
    canView,
    othersCount,
    backgroundColor,
    gridColor,
    showGrid,
    showMinimap,
    showControls,
    cursorColor,
    brandCyan,
    experimentalMode,
    onImportCommunityPreset,
    onProjectNameChange,
  ]);

  return (
    <CanvasHeaderContext.Provider value={value}>
      {children}
    </CanvasHeaderContext.Provider>
  );
};

