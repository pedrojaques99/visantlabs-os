import React, { createContext, useContext, useState, useCallback } from 'react';
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
  const [selectedNodes, setSelectedNodes] = useState<Node<FlowNodeData>[]>([]);
  const [onShareClick, setOnShareClick] = useState<(() => void) | undefined>(undefined);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [othersCount, setOthersCount] = useState(0);
  const [backgroundColor, setBackgroundColorState] = useState('#121212');
  const [gridColor, setGridColorState] = useState('rgba(255, 255, 255, 0.1)');
  const [showGrid, setShowGridState] = useState(true);
  const [showMinimap, setShowMinimapState] = useState(true);
  const [showControls, setShowControlsState] = useState(true);
  const [cursorColor, setCursorColorState] = useState('#FFFFFF');
  const [brandCyan, setBrandCyanState] = useState('#52ddeb');
  const [experimentalMode, setExperimentalMode] = useState(false);
  const [onImportCommunityPreset, setOnImportCommunityPreset] = useState<((preset: any, type: string) => void) | undefined>(undefined);
  const [onProjectNameChange, setOnProjectNameChange] = useState<((name: string) => void) | undefined>(undefined);

  const setProjectName = useCallback((name: string) => {
    setProjectNameState(name);
    if (onProjectNameChange) {
      onProjectNameChange(name);
    }
  }, [onProjectNameChange]);

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

  const value: CanvasHeaderContextValue = {
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
  };

  return (
    <CanvasHeaderContext.Provider value={value}>
      {children}
    </CanvasHeaderContext.Provider>
  );
};

