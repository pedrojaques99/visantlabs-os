import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';

interface CanvasHeaderContextValue {
  projectName?: string;
  setProjectName: (name: string) => void;
  selectedNodesCount: number;
  selectedNodes: Node<FlowNodeData>[];
  setSelectedNodes: (nodes: Node<FlowNodeData>[]) => void;
  onShareClick?: () => void;
  setOnShareClick: (handler: (() => void) | undefined) => void;
  isCollaborative: boolean;
  setIsCollaborative: (value: boolean) => void;
  othersCount: number;
  setOthersCount: (value: number) => void;
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

interface CanvasHeaderProviderProps {
  children: React.ReactNode;
}

export const CanvasHeaderProvider: React.FC<CanvasHeaderProviderProps> = ({ children }) => {
  const [projectName, setProjectNameState] = useState<string>('');
  const [selectedNodesCount, setSelectedNodesCount] = useState(0);
  const [selectedNodes, setSelectedNodesState] = useState<Node<FlowNodeData>[]>([]);
  const [onShareClick, setOnShareClick] = useState<(() => void) | undefined>(undefined);
  const [isCollaborative, setIsCollaborativeState] = useState(false);
  const [othersCount, setOthersCountState] = useState(0);
  
  // Initialize from localStorage with proper defaults
  const [backgroundColor, setBackgroundColorState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasBackgroundColor') || '#121212';
    }
    return '#121212';
  });
  const [gridColor, setGridColorState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasGridColor') || 'rgba(255, 255, 255, 0.1)';
    }
    return 'rgba(255, 255, 255, 0.1)';
  });
  const [showGrid, setShowGridState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasShowGrid');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showMinimap, setShowMinimapState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasShowMinimap');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showControls, setShowControlsState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasShowControls');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [cursorColor, setCursorColorState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasCursorColor') || '#FFFFFF';
    }
    return '#FFFFFF';
  });
  const [brandCyan, setBrandCyanState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canvasBrandCyan') || '#52ddeb';
    }
    return '#52ddeb';
  });
  const [experimentalMode, setExperimentalModeState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvasExperimentalMode');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });
  const [onImportCommunityPreset, setOnImportCommunityPreset] = useState<((preset: any, type: string) => void) | undefined>(undefined);
  const [onProjectNameChange, setOnProjectNameChange] = useState<((name: string) => void) | undefined>(undefined);

  const setProjectName = useCallback((name: string) => {
    // Just update the state - don't call onProjectNameChange here
    // onProjectNameChange should only be called by the header component
    // when the user actually edits the name, not during state synchronization
    // Safety check: ensure name is a string
    setProjectNameState(name && typeof name === 'string' ? name : '');
  }, []);

  const setSelectedNodes = useCallback((nodes: Node<FlowNodeData>[]) => {
    setSelectedNodesState(nodes);
    setSelectedNodesCount(nodes.length);
  }, []);

  const setIsCollaborative = useCallback((value: boolean) => {
    setIsCollaborativeState(value);
  }, []);

  const setOthersCount = useCallback((value: number) => {
    setOthersCountState(value);
  }, []);

  const setExperimentalMode = useCallback((value: boolean) => {
    setExperimentalModeState(value);
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    setBackgroundColorState(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasBackgroundColor', color);
    }
  }, []);

  const setGridColor = useCallback((color: string) => {
    setGridColorState(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasGridColor', color);
    }
  }, []);

  const setShowGrid = useCallback((show: boolean) => {
    setShowGridState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasShowGrid', String(show));
    }
  }, []);

  const setShowMinimap = useCallback((show: boolean) => {
    setShowMinimapState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasShowMinimap', String(show));
    }
  }, []);

  const setShowControls = useCallback((show: boolean) => {
    setShowControlsState(show);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasShowControls', String(show));
    }
  }, []);

  const setCursorColor = useCallback((color: string) => {
    setCursorColorState(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasCursorColor', color);
    }
  }, []);

  const setBrandCyan = useCallback((color: string) => {
    setBrandCyanState(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('canvasBrandCyan', color);
    }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value: CanvasHeaderContextValue = useMemo(() => ({
    projectName,
    setProjectName,
    selectedNodesCount,
    selectedNodes,
    setSelectedNodes,
    onShareClick,
    setOnShareClick,
    isCollaborative,
    setIsCollaborative,
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
    setProjectName,
    selectedNodesCount,
    selectedNodes,
    setSelectedNodes,
    onShareClick,
    setOnShareClick,
    isCollaborative,
    setIsCollaborative,
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
  ]);

  return (
    <CanvasHeaderContext.Provider value={value}>
      {children}
    </CanvasHeaderContext.Provider>
  );
};

