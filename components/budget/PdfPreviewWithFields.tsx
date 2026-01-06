import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Plus, X, MapPin, ChevronLeft, ChevronRight, Check, XCircle, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { BudgetData, PdfFieldMapping } from '../../types';
import { FieldSelectionMenu } from './FieldSelectionMenu';
import { FieldPropertiesPanel } from './FieldPropertiesPanel';

// Configure PDF.js worker - use local worker from public folder
// This ensures it works in all environments including Cloudflare
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// Available fields from BudgetData
const AVAILABLE_FIELDS = [
  { id: 'clientName', label: 'Nome do Cliente' },
  { id: 'projectName', label: 'Nome do Projeto' },
  { id: 'projectDescription', label: 'Descrição do Projeto' },
  { id: 'brandName', label: 'Nome da Marca' },
  { id: 'startDate', label: 'Data de Início' },
  { id: 'endDate', label: 'Data de Término' },
  { id: 'year', label: 'Ano' },
  { id: 'observations', label: 'Observações' },
  { id: 'finalCTAText', label: 'Texto CTA Final' },
  { id: 'custom_text', label: 'Campo de Texto' },
  { id: 'custom_currency', label: 'Campo de Valor (Moeda)' },
];

interface PdfPreviewWithFieldsProps {
  pdfUrl: string;
  data: BudgetData;
  fieldMappings: PdfFieldMapping[];
  onFieldMappingsChange: (mappings: PdfFieldMapping[]) => void;
  editable?: boolean;
  scale?: number;
  positioningFieldId?: string | null;
  onPositioningModeChange?: (fieldId: string | null) => void;
  onFieldSelect?: (fieldId: string | null) => void;
  selectedFieldId?: string | null;
  // External drag state management
  externalActiveId?: string | null;
  externalOnDragStart?: (event: DragStartEvent) => void;
  externalOnDragEnd?: (event: DragEndEvent) => void;
  // Pending field position state
  pendingFieldPosition?: { pageNum: number; x: number; y: number } | null;
  onPendingFieldPositionChange?: (position: { pageNum: number; x: number; y: number } | null) => void;
  onAddFieldFromForm?: (fieldId: string) => void;
  onDragCancel?: () => void;
}

// Helper to get field value from BudgetData or custom value
const getFieldValue = (data: BudgetData, mapping: PdfFieldMapping): string => {
  // If custom value exists, use it
  if (mapping.customValue !== undefined && mapping.customValue !== null) {
    return mapping.customValue;
  }
  
  const fieldId = mapping.fieldId;
  
  switch (fieldId) {
    case 'clientName':
      return data.clientName;
    case 'projectName':
      return data.projectName;
    case 'projectDescription':
      return data.projectDescription;
    case 'brandName':
      return data.brandName;
    case 'startDate':
      return new Date(data.startDate).toLocaleDateString('pt-BR');
    case 'endDate':
      return new Date(data.endDate).toLocaleDateString('pt-BR');
    case 'year':
      return data.year || new Date().getFullYear().toString();
    case 'observations':
      return data.observations || '';
    case 'finalCTAText':
      return data.finalCTAText || '';
    default:
      // Handle nested fields like deliverables, timeline, etc.
      if (fieldId.startsWith('deliverable.')) {
        const index = parseInt(fieldId.split('.')[1]);
        const deliverable = data.deliverables[index];
        if (!deliverable) return '';
        const subField = fieldId.split('.')[2];
        if (subField === 'name') return deliverable.name;
        if (subField === 'description') return deliverable.description;
        if (subField === 'quantity') return deliverable.quantity.toString();
        if (subField === 'unitValue') return deliverable.unitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (subField === 'total') {
          return (deliverable.quantity * deliverable.unitValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
      }
      // Custom fields (starting with custom_)
      if (fieldId.startsWith('custom_')) {
        if (fieldId === 'custom_currency' && mapping.customValue) {
          // Formata como moeda brasileira
          const num = parseFloat(mapping.customValue);
          if (!isNaN(num)) {
            return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          }
        }
        return mapping.customValue || '';
      }
      return '';
  }
};

export const PdfPreviewWithFields: React.FC<PdfPreviewWithFieldsProps> = ({
  pdfUrl,
  data,
  fieldMappings,
  onFieldMappingsChange,
  editable = false,
  scale = 1.0,
  positioningFieldId,
  onPositioningModeChange,
  onFieldSelect,
  selectedFieldId: externalSelectedFieldId,
  externalActiveId,
  externalOnDragStart,
  externalOnDragEnd,
  onPendingFieldPositionChange,
  pendingFieldPosition: externalPendingFieldPosition,
  onAddFieldFromForm,
  onDragCancel: externalOnDragCancel,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(800);
  const [isAddingField, setIsAddingField] = useState(false);
  const isPositioningMode = positioningFieldId !== null && positioningFieldId !== undefined;
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickedPage, setClickedPage] = useState<number>(1);
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null);
  const [internalSelectedFieldId, setInternalSelectedFieldId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [documentKey, setDocumentKey] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(scale);
  const [draggingVariable, setDraggingVariable] = useState<{ fieldId: string; label: string; pageNum: number; x: number; y: number } | null>(null);
  const [internalPendingFieldPosition, setInternalPendingFieldPosition] = useState<{ pageNum: number; x: number; y: number } | null>(null);
  const [fieldPositions, setFieldPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  // Update field positions when scroll or zoom changes
  useEffect(() => {
    const updateFieldPositions = () => {
      const container = document.getElementById('pdf-preview-container');
      if (!container) return;
      
      const newPositions = new Map<string, { x: number; y: number }>();
      
      fieldMappings.forEach((mapping) => {
        const instanceId = mapping.id || mapping.fieldId;
        const pageNum = mapping.page || 1;
        const pageElement = pageRefs.current[pageNum];
        
        if (!pageElement) return;
        
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageElement.getBoundingClientRect();
        
        const pageOffsetX = pageRect.left - containerRect.left + container.scrollLeft;
        const pageOffsetY = pageRect.top - containerRect.top + container.scrollTop;
        
        const fieldX = pageOffsetX + pointsToPixels(mapping.x, pageScale);
        const fieldY = pageOffsetY + pointsToPixels(mapping.y, pageScale);
        
        newPositions.set(instanceId, { x: fieldX, y: fieldY });
      });
      
      setFieldPositions(newPositions);
    };
    
    updateFieldPositions();
    
    const container = document.getElementById('pdf-preview-container');
    if (container) {
      container.addEventListener('scroll', updateFieldPositions);
      window.addEventListener('resize', updateFieldPositions);
      
      return () => {
        container.removeEventListener('scroll', updateFieldPositions);
        window.removeEventListener('resize', updateFieldPositions);
      };
    }
  }, [fieldMappings, zoomLevel, numPages]);
  
  // Unified state management helpers
  const activeId = externalActiveId !== undefined ? externalActiveId : internalActiveId;
  const pendingFieldPosition = externalPendingFieldPosition !== undefined ? externalPendingFieldPosition : internalPendingFieldPosition;
  
  const setActiveId = useCallback((id: string | null) => {
    if (externalActiveId === undefined) {
      setInternalActiveId(id);
    }
    // If external, parent manages it
  }, [externalActiveId]);
  
  const setPendingFieldPosition = useCallback((position: { pageNum: number; x: number; y: number } | null) => {
    if (onPendingFieldPositionChange) {
      onPendingFieldPositionChange(position);
    } else {
      setInternalPendingFieldPosition(position);
    }
  }, [onPendingFieldPositionChange]);

  // Sync zoomLevel with scale prop when it changes
  useEffect(() => {
    setZoomLevel(scale);
  }, [scale]);

  // Use external selectedFieldId if provided, otherwise use internal state
  const selectedFieldId = externalSelectedFieldId !== undefined ? externalSelectedFieldId : internalSelectedFieldId;

  // Note: DndContext is now handled by parent (BudgetMachinePage)
  // We no longer create our own sensors here

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('pdf-preview-container');
      if (container) {
        const availableHeight = window.innerHeight - 200; // Reserve space for header/controls
        const availableWidth = container.clientWidth - 40;
        setContainerHeight(Math.max(400, availableHeight));
        setContainerWidth(availableWidth);
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    // Reset to page 1 when document loads
    if (pageNumber > numPages) {
      setPageNumber(1);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!editable) return;
    const activeIdStr = event.active.id as string;
    setActiveId(activeIdStr);
    if (externalOnDragStart) {
      externalOnDragStart(event);
    }
    
    // If dragging a variable, create temporary field for preview
    if (activeIdStr.startsWith('variable-')) {
      const fieldId = activeIdStr.replace('variable-', '');
      const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
      if (field) {
        setDraggingVariable({
          fieldId,
          label: field.label,
          pageNum: 1, // Will be updated on drag
          x: 0,
          y: 0,
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!editable || !activeId) {
      setActiveId(null);
      if (externalOnDragEnd) {
        externalOnDragEnd(event);
      }
      return;
    }

    const { active, over } = event;
    const activeIdStr = active.id as string;

    // Check if dragging a variable from the menu
    if (activeIdStr.startsWith('variable-')) {
      if (!over || !over.id) {
        setActiveId(null);
        setDraggingVariable(null);
        if (externalOnDragEnd) {
          externalOnDragEnd(event);
        }
        return;
      }

      // Extract fieldId from variable-{fieldId}
      const fieldId = activeIdStr.replace('variable-', '');
      const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
      if (!field) {
        setActiveId(null);
        setDraggingVariable(null);
        if (externalOnDragEnd) {
          externalOnDragEnd(event);
        }
        return;
      }

      // Check if dropped on a PDF page
      const overIdStr = over.id as string;
      if (overIdStr.startsWith('pdf-page-')) {
        const pageNum = parseInt(overIdStr.replace('pdf-page-', ''));
        if (isNaN(pageNum)) {
          setActiveId(null);
          setDraggingVariable(null);
          if (externalOnDragEnd) {
            externalOnDragEnd(event);
          }
          return;
        }

        // Get drop position using the over rect center
        const container = document.getElementById('pdf-preview-container');
        const pageElement = pageRefs.current[pageNum];
        if (!container || !pageElement || !over.rect) {
          setActiveId(null);
          setDraggingVariable(null);
          if (externalOnDragEnd) {
            externalOnDragEnd(event);
          }
          return;
        }

        // Get mouse position relative to page
        const pageRect = pageElement.getBoundingClientRect();
        
        // Calculate drop position based on the center of the over rect
        const dropX = over.rect.left + over.rect.width / 2;
        const dropY = over.rect.top + over.rect.height / 2;
        
        const relativeX = dropX - pageRect.left + container.scrollLeft;
        const relativeY = dropY - pageRect.top + container.scrollTop;

        const x = pixelsToPoints(relativeX, pageScale);
        const y = pixelsToPoints(relativeY, pageScale);

        // Create new mapping
        const newMapping: PdfFieldMapping = {
          id: `${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fieldId,
          label: field.label,
          x: Math.max(0, x),
          y: Math.max(0, y),
          fontSize: 12,
          color: '#000000',
          align: 'left',
          page: pageNum,
          fontFamily: 'geist',
          bold: false,
        };

        onFieldMappingsChange([...fieldMappings, newMapping]);
        setActiveId(null);
        setDraggingVariable(null);
        if (externalOnDragEnd) {
          externalOnDragEnd(event);
        }
        return;
      }
    }

    // Original behavior: moving existing field
    if (isAddingField || isPositioningMode) {
      setActiveId(null);
      if (externalOnDragEnd) {
        externalOnDragEnd(event);
      }
      return;
    }

    const mapping = fieldMappings.find(m => (m.id || m.fieldId) === activeIdStr);
    if (!mapping || !over) {
      setActiveId(null);
      if (externalOnDragEnd) {
        externalOnDragEnd(event);
      }
      return;
    }

    // Improved drag calculation: use rect positions to calculate delta
    // Get current position in pixels (from PDF points)
    const currentX = pointsToPixels(mapping.x, pageScale);
    const currentY = pointsToPixels(mapping.y, pageScale);

    // Calculate delta from active and over positions
    // Use the difference between the final position and initial position
    // active.rect is a MutableRefObject with initial and translated properties
    const activeRect = active.rect?.current?.translated || active.rect?.current?.initial;
    const delta = {
      x: (over.rect?.left || 0) - (activeRect?.left || 0),
      y: (over.rect?.top || 0) - (activeRect?.top || 0),
    };

    // Add delta (movement in pixels) to current position
    const newXPixels = currentX + delta.x;
    const newYPixels = currentY + delta.y;

    // Convert back to PDF points
    const newX = Math.max(0, pixelsToPoints(newXPixels, pageScale));
    const newY = Math.max(0, pixelsToPoints(newYPixels, pageScale));
    
    const mappingId = mapping.id || mapping.fieldId;
    const updatedMappings = fieldMappings.map(m =>
      (m.id || m.fieldId) === mappingId
        ? { ...m, x: newX, y: newY }
        : m
    );
    onFieldMappingsChange(updatedMappings);

    setActiveId(null);
    if (externalOnDragEnd) {
      externalOnDragEnd(event);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDraggingVariable(null);
    if (externalOnDragCancel) {
      externalOnDragCancel();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!editable) return;
    
    // Don't handle clicks on fields
    const target = e.target as HTMLElement;
    if (target.closest('[data-field-id]')) {
      return;
    }

    // Helper to calculate click position in PDF points
    const calculateClickPosition = () => {
      const container = document.getElementById('pdf-preview-container');
      const pageElement = pageRefs.current[pageNum];
      if (!container || !pageElement) return null;

      const pageRect = pageElement.getBoundingClientRect();
      const relativeX = e.clientX - pageRect.left + container.scrollLeft;
      const relativeY = e.clientY - pageRect.top + container.scrollTop;

      return {
        x: pixelsToPoints(relativeX, pageScale),
        y: pixelsToPoints(relativeY, pageScale),
        pageNum,
      };
    };

    // Priority 1: If in positioning mode, position the field that was just added
    if (isPositioningMode && positioningFieldId) {
      const position = calculateClickPosition();
      if (!position) return;

      // Find the most recently added instance of this field (the one we're positioning)
      const instancesToPosition = fieldMappings.filter(m => m.fieldId === positioningFieldId);
      const instanceToUpdate = instancesToPosition[instancesToPosition.length - 1];
      
      if (instanceToUpdate) {
        const instanceId = instanceToUpdate.id || instanceToUpdate.fieldId;
        const updatedMappings = fieldMappings.map(m =>
          (m.id || m.fieldId) === instanceId
            ? { ...m, x: Math.max(0, position.x), y: Math.max(0, position.y), page: position.pageNum }
            : m
        );
        onFieldMappingsChange(updatedMappings);
        
        // Exit positioning mode and select the field instance
        if (onPositioningModeChange) {
          onPositioningModeChange(null);
        }
        if (onFieldSelect) {
          onFieldSelect(instanceId);
        } else {
          setInternalSelectedFieldId(instanceId);
        }
      }
      return;
    }
    
    // Priority 2: If in "add field" mode (from variable menu), show selection menu
    if (isAddingField) {
      // Use viewport coordinates for fixed positioning
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setClickedPage(pageNum);
      return;
    }
    
    // Priority 3: Default behavior - set pending position for adding field from form
    // This allows user to click on PDF, then click on a form field to add it
    const position = calculateClickPosition();
    if (position) {
      setPendingFieldPosition({ 
        pageNum: position.pageNum, 
        x: Math.max(0, position.x), 
        y: Math.max(0, position.y) 
      });
    }
  };

  // Sync clickedPage with pageNumber when page changes
  useEffect(() => {
    setClickedPage(pageNumber);
  }, [pageNumber]);

  // Handle page visibility changes to prevent PDF from disappearing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsVisible(true);
        // Force document reload by updating key when tab becomes visible
        if (!isVisible) {
          setIsReloading(true);
          setDocumentKey(prev => prev + 1);
          // Reset reloading state after a short delay
          setTimeout(() => {
            setIsReloading(false);
          }, 500);
        }
      } else {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isVisible]);

  const handleAddField = (fieldId: string) => {
    if (!menuPosition || !clickedPage) return;

    const container = document.getElementById('pdf-preview-container');
    const pageElement = pageRefs.current[clickedPage];
    if (!container || !pageElement) return;

    // Get container and page positions
    const containerRect = container.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    
    // Calculate position relative to the page
    // menuPosition uses viewport coordinates, need to convert to page-relative
    const relativeX = menuPosition.x - pageRect.left + container.scrollLeft;
    const relativeY = menuPosition.y - pageRect.top + container.scrollTop;

    // Convert to PDF points
    const x = pixelsToPoints(relativeX, pageScale);
    const y = pixelsToPoints(relativeY, pageScale);

    // Create new mapping instance (allow multiple instances of same field)
    const newMapping: PdfFieldMapping = {
      id: `${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID for this instance
      fieldId,
      x: Math.max(0, x),
      y: Math.max(0, y),
      fontSize: 12,
      color: '#000000',
      align: 'left',
      page: clickedPage,
    };

    onFieldMappingsChange([...fieldMappings, newMapping]);
    setMenuPosition(null);
    setIsAddingField(false);
  };

  const getAvailableFields = () => {
    // Allow all fields to be added multiple times
    return AVAILABLE_FIELDS;
  };

  // Convert PDF points to screen pixels (approximate: 72 points = 1 inch)
  // Improved calculation with better precision
  const pointsToPixels = useCallback((points: number, pageScale: number) => {
    if (isNaN(points) || isNaN(pageScale) || pageScale <= 0) return 0;
    return (points / 72) * 96 * pageScale; // 96 DPI
  }, []);

  const pixelsToPoints = useCallback((pixels: number, pageScale: number) => {
    if (isNaN(pixels) || isNaN(pageScale) || pageScale <= 0) return 0;
    return (pixels / 96) * 72 / pageScale;
  }, []);

  // Calculate scale based on height (A4 height is 792 points)
  // Use height-based scaling to fit screen height, multiplied by zoom level
  const pageScale = zoomLevel * (containerHeight / 792); // A4 height in points is 792

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3.0)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5)); // Min zoom 0.5x
  };

  const handleZoomReset = () => {
    setZoomLevel(1.0);
  };

  // Update cursor style when in add mode or positioning mode
  useEffect(() => {
    if ((isAddingField || isPositioningMode) && editable) {
      document.body.style.cursor = 'crosshair';
      return () => {
        document.body.style.cursor = '';
      };
    }
  }, [isAddingField, isPositioningMode, editable]);

  // Update dragging variable position on mouse move
  useEffect(() => {
    if (!draggingVariable) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('pdf-preview-container');
      if (!container) return;

      // Find which page the mouse is over
      let currentPage = 1;
      let minDistance = Infinity;
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const pageElement = pageRefs.current[pageNum];
        if (!pageElement) continue;
        
        const pageRect = pageElement.getBoundingClientRect();
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Check if mouse is over this page
        if (mouseX >= pageRect.left && mouseX <= pageRect.right &&
            mouseY >= pageRect.top && mouseY <= pageRect.bottom) {
          const distance = Math.abs(mouseX - (pageRect.left + pageRect.width / 2)) +
                          Math.abs(mouseY - (pageRect.top + pageRect.height / 2));
          if (distance < minDistance) {
            minDistance = distance;
            currentPage = pageNum;
          }
        }
      }

      // Calculate position relative to the page
      const pageElement = pageRefs.current[currentPage];
      if (!pageElement) return;

      const pageRect = pageElement.getBoundingClientRect();
      const relativeX = e.clientX - pageRect.left + container.scrollLeft;
      const relativeY = e.clientY - pageRect.top + container.scrollTop;

      const x = pixelsToPoints(relativeX, pageScale);
      const y = pixelsToPoints(relativeY, pageScale);

      setDraggingVariable(prev => prev ? {
        ...prev,
        pageNum: currentPage,
        x: Math.max(0, x),
        y: Math.max(0, y),
      } : null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [draggingVariable, numPages, pageScale]);

  const handleRemoveMapping = useCallback(() => {
    if (!selectedFieldId) return;
    const updatedMappings = fieldMappings.filter(m => (m.id || m.fieldId) !== selectedFieldId);
    onFieldMappingsChange(updatedMappings);
    if (onFieldSelect) {
      onFieldSelect(null);
    } else {
      setInternalSelectedFieldId(null);
    }
  }, [selectedFieldId, fieldMappings, onFieldMappingsChange, onFieldSelect]);

  // Handle Escape key to exit positioning mode
  useEffect(() => {
    if (!editable || !isPositioningMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (onPositioningModeChange) {
          onPositioningModeChange(null);
        }
        if (onFieldSelect) {
          onFieldSelect(null);
        } else {
          setInternalSelectedFieldId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editable, isPositioningMode, onPositioningModeChange, onFieldSelect]);

  // Handle Delete key to remove selected field
  useEffect(() => {
    if (!editable || isPositioningMode || !selectedFieldId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't delete if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleRemoveMapping();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editable, isPositioningMode, selectedFieldId, handleRemoveMapping]);

  // Handle ESC key to close pending field position
  useEffect(() => {
    if (!editable || !pendingFieldPosition) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setPendingFieldPosition(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editable, pendingFieldPosition, setPendingFieldPosition]);

  // Get active field for drag overlay
  const activeField = activeId
    ? fieldMappings.find(m => (m.id || m.fieldId) === activeId)
    : null;

  const selectedMapping = selectedFieldId
    ? fieldMappings.find(m => (m.id || m.fieldId) === selectedFieldId)
    : null;

  const handleFieldClick = (instanceId: string) => {
    if (!editable || isPositioningMode) return;
    const newSelectedId = instanceId === selectedFieldId ? null : instanceId;
    if (onFieldSelect) {
      onFieldSelect(newSelectedId);
    } else {
      setInternalSelectedFieldId(newSelectedId);
    }
  };

  const handleUpdateMapping = (updates: Partial<PdfFieldMapping>) => {
    if (!selectedFieldId) return;
    const updatedMappings = fieldMappings.map(m =>
      m.fieldId === selectedFieldId ? { ...m, ...updates } : m
    );
    onFieldMappingsChange(updatedMappings);
  };

  return (
    <div className="w-full h-full flex">
        <div 
          id="pdf-preview-container" 
          className="flex-1 overflow-auto bg-zinc-200 px-4 py-4 relative"
          style={{ cursor: (isAddingField || isPositioningMode) ? 'crosshair' : 'default' }}
        >
      {/* Zoom controls - top right */}
      <div className="sticky top-0 z-40 mb-4 flex justify-end">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-zinc-300/50 rounded-md px-2 py-1.5 shadow-sm">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
            className="p-1.5 hover:bg-zinc-200/50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Diminuir zoom"
          >
            <ZoomOut size={16} className="text-zinc-700" />
          </button>
          <span className="text-xs font-mono text-zinc-700 px-2 min-w-[3rem] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3.0}
            className="p-1.5 hover:bg-zinc-200/50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Aumentar zoom"
          >
            <ZoomIn size={16} className="text-zinc-700" />
          </button>
          <div className="w-px h-4 bg-zinc-300 mx-1" />
          <button
            onClick={handleZoomReset}
            className="text-xs font-mono text-zinc-700 px-2 py-1 hover:bg-zinc-200/50 rounded transition-colors"
            title="Resetar zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Pending field position indicator - top */}
      {pendingFieldPosition && editable && (
        <div className="sticky top-0 z-40 mb-4">
          <div className="px-4 py-2 bg-brand-cyan/20 border border-[#52ddeb]/50 rounded-md max-w-4xl mx-auto flex items-center gap-3">
            <p className="text-sm font-mono text-brand-cyan flex items-center gap-2 flex-1">
              <MapPin size={16} />
              Posição selecionada! Clique em um campo preenchido do formulário para adicioná-lo aqui.
            </p>
            <button
              onClick={() => setPendingFieldPosition(null)}
              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-md text-red-400 transition-colors"
              title="Cancelar"
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Positioning mode indicator - top */}
      {isPositioningMode && editable && positioningFieldId && (
        <div className="sticky top-0 z-40 mb-4">
          <div className="px-4 py-2 bg-brand-cyan/20 border border-[#52ddeb]/50 rounded-md max-w-4xl mx-auto flex items-center gap-3">
            <p className="text-sm font-mono text-brand-cyan flex items-center gap-2 flex-1">
              <MapPin size={16} />
              Clique no PDF para posicionar: {AVAILABLE_FIELDS.find(f => f.id === positioningFieldId)?.label || positioningFieldId}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onPositioningModeChange) {
                    onPositioningModeChange(null);
                  }
                  if (onFieldSelect) {
                    onFieldSelect(null);
                  } else {
                    setInternalSelectedFieldId(null);
                  }
                }}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-md text-red-400 transition-colors"
                title="Cancelar"
              >
                <XCircle size={16} />
              </button>
              <button
                onClick={() => {
                  if (onPositioningModeChange) {
                    onPositioningModeChange(null);
                  }
                  if (onFieldSelect && positioningFieldId) {
                    onFieldSelect(positioningFieldId);
                  } else if (positioningFieldId) {
                    setInternalSelectedFieldId(positioningFieldId);
                  }
                }}
                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-md text-green-400 transition-colors"
                title="Aceitar"
              >
                <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field selection menu */}
      {menuPosition && editable && (
        <FieldSelectionMenu
          fields={getAvailableFields()}
          position={menuPosition}
          onSelect={handleAddField}
          onClose={() => {
            setMenuPosition(null);
            setIsAddingField(false);
          }}
        />
      )}

      <div className="flex flex-col items-center" style={{ minHeight: 0, fontSize: 0, paddingTop: '16px', paddingBottom: '16px' }}>
        <style>{`
          .react-pdf__Document {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            font-size: 0 !important;
          }
          .react-pdf__Page {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 0 !important;
            line-height: 0 !important;
          }
          .react-pdf__Page__canvas {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            height: auto !important;
            vertical-align: top !important;
          }
          .react-pdf__Page__textContent {
            margin: 0 !important;
            padding: 0 !important;
            display: none !important;
          }
          .react-pdf__Page__annotations {
            margin: 0 !important;
            padding: 0 !important;
            display: none !important;
          }
          .react-pdf__Page__annotationLayer {
            margin: 0 !important;
            padding: 0 !important;
            display: none !important;
          }
          #pdf-preview-container .react-pdf__Page {
            margin-bottom: 0 !important;
          }
          #pdf-preview-container > div > div {
            margin-bottom: 0 !important;
          }
          #pdf-preview-container .relative {
            font-size: 0 !important;
            line-height: 0 !important;
          }
          #pdf-preview-container .relative > * {
            font-size: initial !important;
            line-height: initial !important;
          }
          .react-pdf__Page > div:not(.react-pdf__Page__canvas) {
            display: none !important;
          }
          .react-pdf__Page > canvas {
            display: block !important;
          }
        `}</style>
        {/* PDF Document */}
        {(isReloading || !isVisible) && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-200/80 z-30">
            <div className="text-center">
              <div className="text-zinc-600 font-mono text-sm mb-2">Recarregando PDF...</div>
              <div className="w-8 h-8 border-2 border-[#52ddeb] border-t-transparent rounded-md animate-spin mx-auto"></div>
            </div>
          </div>
        )}
        <Document
          key={documentKey}
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-zinc-600">Carregando PDF...</div>}
          error={<div className="text-red-600">Erro ao carregar PDF</div>}
        >
          {numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <DroppablePage
              key={`page_${pageNum}`}
              pageNum={pageNum}
              totalPages={numPages}
              pageRefs={pageRefs}
              onClick={(e) => handleCanvasClick(e, pageNum)}
              isAddingField={isAddingField}
              isPositioningMode={isPositioningMode}
            >
              <Page
                pageNumber={pageNum}
                height={containerHeight * zoomLevel}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="[&>canvas]:block"
              />
            </DroppablePage>
          ))}
        </Document>

        {/* Fields Overlay - renders all fields above all pages */}
        <div 
          className="absolute inset-0"
          style={{ zIndex: 100 }}
        >
          {numPages > 0 && fieldMappings.map((mapping) => {
            const instanceId = mapping.id || mapping.fieldId;
            const position = fieldPositions.get(instanceId);
            
            if (!position) return null;
            
            return (
              <DraggableField
                key={instanceId}
                mapping={mapping}
                data={data}
                pageScale={pageScale}
                editable={editable && !isAddingField && !isPositioningMode}
                isPositioning={positioningFieldId === mapping.fieldId}
                isSelected={selectedFieldId === instanceId}
                onSelect={handleFieldClick}
                onDelete={() => {
                  const updatedMappings = fieldMappings.filter(m => (m.id || m.fieldId) !== instanceId);
                  onFieldMappingsChange(updatedMappings);
                  if (onFieldSelect) {
                    onFieldSelect(null);
                  } else {
                    setInternalSelectedFieldId(null);
                  }
                }}
                pointsToPixels={pointsToPixels}
                getFieldValue={getFieldValue}
                AVAILABLE_FIELDS={AVAILABLE_FIELDS}
                absolutePosition={position}
              />
            );
          })}
          
          {/* Temporary field preview while dragging */}
          {draggingVariable && (() => {
            const pageElement = pageRefs.current[draggingVariable.pageNum];
            if (!pageElement) return null;
            
            const container = document.getElementById('pdf-preview-container');
            if (!container) return null;
            
            const containerRect = container.getBoundingClientRect();
            const pageRect = pageElement.getBoundingClientRect();
            
            const pageOffsetX = pageRect.left - containerRect.left + container.scrollLeft;
            const pageOffsetY = pageRect.top - containerRect.top + container.scrollTop;
            
            const fieldX = pageOffsetX + pointsToPixels(draggingVariable.x, pageScale);
            const fieldY = pageOffsetY + pointsToPixels(draggingVariable.y, pageScale);
            
            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${fieldX}px`,
                  top: `${fieldY}px`,
                  fontSize: `${12 * pageScale}px`,
                  color: '#000000',
                  backgroundColor: 'rgba(82, 221, 235, 0.2)',
                  border: '2px dashed #52ddeb',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  pointerEvents: 'none',
                  zIndex: 150,
                  opacity: 0.8,
                }}
              >
                {draggingVariable.label}
              </div>
            );
          })()}
          
          {/* Pending position indicator */}
          {pendingFieldPosition && (() => {
            const pageElement = pageRefs.current[pendingFieldPosition.pageNum];
            if (!pageElement) return null;
            
            const container = document.getElementById('pdf-preview-container');
            if (!container) return null;
            
            const containerRect = container.getBoundingClientRect();
            const pageRect = pageElement.getBoundingClientRect();
            
            const pageOffsetX = pageRect.left - containerRect.left + container.scrollLeft;
            const pageOffsetY = pageRect.top - containerRect.top + container.scrollTop;
            
            const fieldX = pageOffsetX + pointsToPixels(pendingFieldPosition.x, pageScale);
            const fieldY = pageOffsetY + pointsToPixels(pendingFieldPosition.y, pageScale);
            
            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${fieldX}px`,
                  top: `${fieldY}px`,
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#52ddeb',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 0 2px rgba(82, 221, 235, 0.5)',
                  pointerEvents: 'none',
                  zIndex: 150,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })()}
        </div>

      </div>
      
      {/* Field Properties Panel - positioned below selected field with smart positioning */}
      {selectedMapping && editable && (() => {
        const panelX = pointsToPixels(selectedMapping.x, pageScale);
        const panelY = pointsToPixels(selectedMapping.y, pageScale) + (selectedMapping.fontSize || 12) * pageScale + 10;
        const container = document.getElementById('pdf-preview-container');
        const containerRect = container?.getBoundingClientRect();
        
        // Calculate if panel would go off-screen
        const panelWidth = 350; // Approximate panel width
        const panelHeight = 400; // Approximate panel height
        const viewportWidth = containerRect?.width || window.innerWidth;
        const viewportHeight = containerRect?.height || window.innerHeight;
        const scrollLeft = container?.scrollLeft || 0;
        const scrollTop = container?.scrollTop || 0;
        
        // Adjust position to keep panel in viewport
        let adjustedX = panelX;
        let adjustedY = panelY;
        
        if (panelX + panelWidth > viewportWidth + scrollLeft) {
          adjustedX = Math.max(0, viewportWidth + scrollLeft - panelWidth - 10);
        }
        if (panelY + panelHeight > viewportHeight + scrollTop) {
          adjustedY = Math.max(0, panelY - panelHeight - (selectedMapping.fontSize || 12) * pageScale - 20);
        }
        if (adjustedX < scrollLeft) {
          adjustedX = scrollLeft + 10;
        }
        if (adjustedY < scrollTop) {
          adjustedY = scrollTop + 10;
        }
        
        return (
          <div
            style={{
              position: 'absolute',
              left: `${adjustedX}px`,
              top: `${adjustedY}px`,
              zIndex: 200,
              minWidth: '300px',
              maxWidth: '400px',
            }}
            className="bg-zinc-900 border border-zinc-800 rounded-md shadow-xl"
            role="dialog"
            aria-label="Painel de propriedades do campo"
          >
          <FieldPropertiesPanel
            mapping={selectedMapping}
            onUpdate={(updates) => {
              const updatedMappings = fieldMappings.map(m =>
                (m.id || m.fieldId) === selectedFieldId ? { ...m, ...updates } : m
              );
              onFieldMappingsChange(updatedMappings);
            }}
            onRemove={() => {
              const updatedMappings = fieldMappings.filter(m => (m.id || m.fieldId) !== selectedFieldId);
              onFieldMappingsChange(updatedMappings);
              if (onFieldSelect) {
                onFieldSelect(null);
              } else {
                setInternalSelectedFieldId(null);
              }
            }}
            onClose={() => {
              if (onFieldSelect) {
                onFieldSelect(null);
              } else {
                setInternalSelectedFieldId(null);
              }
            }}
            currentPage={selectedMapping.page || 1}
            totalPages={numPages}
          />
        </div>
        );
      })()}
        </div>

    </div>
  );
};

// Droppable Page Component
interface DroppablePageProps {
  pageNum: number;
  totalPages: number;
  pageRefs: React.MutableRefObject<{ [key: number]: HTMLDivElement | null }>;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  isAddingField: boolean;
  isPositioningMode: boolean;
  children: React.ReactNode;
}

const DroppablePage: React.FC<DroppablePageProps> = ({
  pageNum,
  totalPages,
  pageRefs,
  onClick,
  isAddingField,
  isPositioningMode,
  children,
}) => {
  const { setNodeRef } = useDroppable({
    id: `pdf-page-${pageNum}`,
  });

  return (
    <div
      ref={(el) => {
        if (el) {
          pageRefs.current[pageNum] = el;
          setNodeRef(el);
        }
      }}
      data-page={pageNum}
      className="relative"
      onClick={onClick}
      style={{ 
        cursor: (isAddingField || isPositioningMode) ? 'crosshair' : 'default',
        lineHeight: 0,
        display: 'block',
        marginBottom: pageNum < totalPages ? '16px' : '0',
        fontSize: 0,
        width: 'fit-content',
        height: 'auto'
      }}
    >
      {children}
    </div>
  );
};

// Draggable Field Component
interface DraggableFieldProps {
  mapping: PdfFieldMapping;
  data: BudgetData;
  pageScale: number;
  editable: boolean;
  isPositioning: boolean;
  isSelected?: boolean;
  onSelect?: (fieldId: string) => void;
  onDelete?: () => void;
  pointsToPixels: (points: number, pageScale: number) => number;
  getFieldValue: (data: BudgetData, mapping: PdfFieldMapping) => string;
  AVAILABLE_FIELDS: Array<{ id: string; label: string }>;
  absolutePosition?: { x: number; y: number };
}

const DraggableField: React.FC<DraggableFieldProps> = ({
  mapping,
  data,
  pageScale,
  editable,
  isPositioning,
  isSelected,
  onSelect,
  onDelete,
  pointsToPixels,
  getFieldValue,
  AVAILABLE_FIELDS,
  absolutePosition,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const instanceId = mapping.id || mapping.fieldId;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: instanceId,
    disabled: !editable || isPositioning,
  });

  // Use absolute position if provided (for overlay rendering), otherwise calculate relative to page
  const x = absolutePosition ? absolutePosition.x : pointsToPixels(mapping.x, pageScale);
  const y = absolutePosition ? absolutePosition.y : pointsToPixels(mapping.y, pageScale);
  const fieldValue = getFieldValue(data, mapping);
  const fieldLabel = mapping.label || AVAILABLE_FIELDS.find(f => f.id === mapping.fieldId)?.label || mapping.fieldId;

  // Map font family to CSS class
  const getFontFamilyClass = (fontFamily?: string) => {
    switch (fontFamily) {
      case 'geist':
        return 'font-geist';
      case 'manrope':
        return 'font-manrope';
      case 'redhatmono':
        return 'font-redhatmono';
      case 'barlow':
        return 'font-barlow';
      default:
        return 'font-geist';
    }
  };

  const fontFamilyClass = getFontFamilyClass(mapping.fontFamily);

  // Combine transform for translate and scale
  const translateTransform = CSS.Translate.toString(transform);
  const scaleValue = isDragging ? 1.05 : isPositioning ? 1.1 : 1;
  const combinedTransform = translateTransform 
    ? `${translateTransform} scale(${scaleValue})`
    : `scale(${scaleValue})`;

  const style: React.CSSProperties = {
    left: `${x}px`,
    top: `${y}px`,
    fontSize: mapping.fontSize ? `${mapping.fontSize * pageScale}px` : '12px',
    color: mapping.color || '#000000',
    textAlign: mapping.align || 'left',
    fontWeight: mapping.bold ? 'bold' : 'normal',
    transform: combinedTransform,
    cursor: editable ? (isDragging ? 'grabbing' : 'grab') : 'default',
    backgroundColor: editable && !isDragging
      ? isSelected
        ? 'rgba(82, 221, 235, 0.15)'
        : 'rgba(82, 221, 235, 0.08)'
      : editable && isDragging
      ? 'rgba(82, 221, 235, 0.2)'
      : 'transparent',
    border: editable
      ? isDragging
        ? '2px solid #52ddeb'
        : isSelected
        ? '2px solid #52ddeb'
        : '1px solid rgba(82, 221, 235, 0.4)'
      : 'none',
    padding: editable ? '3px 6px' : '0',
    borderRadius: editable ? 'var(--radius)' : '0',
    boxShadow: editable && isDragging
      ? '0 8px 16px rgba(82, 221, 235, 0.4)'
      : editable && isSelected
      ? '0 4px 12px rgba(82, 221, 235, 0.3)'
      : editable
      ? '0 2px 4px rgba(0, 0, 0, 0.1)'
      : 'none',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 200 : isPositioning ? 200 : isSelected ? 150 : 100,
    transition: isDragging ? 'none' : 'all 0.2s ease',
    willChange: isDragging ? 'transform' : 'auto',
    pointerEvents: editable ? 'auto' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      data-field-id={instanceId}
      className={`absolute ${isPositioning ? 'ring-2 ring-[#52ddeb]' : ''} ${isSelected ? 'ring-2 ring-[#52ddeb]' : ''} ${fontFamilyClass}`}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect && editable && !isPositioning) {
          onSelect(instanceId);
        }
      }}
      onMouseEnter={() => editable && !isDragging && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...listeners}
      {...attributes}
      title={editable ? `Arraste para mover: ${fieldLabel}` : fieldValue || fieldLabel}
      role="button"
      aria-label={`Campo ${fieldLabel}${isSelected ? ' selecionado' : ''}`}
      tabIndex={editable && !isPositioning ? 0 : -1}
    >
      {fieldValue || `[${fieldLabel}]`}
      {editable && isHovered && !isDragging && !isPositioning && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 border border-red-600 rounded-md text-white transition-colors z-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          title="Deletar campo (Delete)"
          aria-label={`Deletar campo ${fieldLabel}`}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

// Drag Overlay Component - shows preview during drag
interface DraggableFieldOverlayProps {
  mapping: PdfFieldMapping;
  data: BudgetData;
  pageScale: number;
  pointsToPixels: (points: number, pageScale: number) => number;
  getFieldValue: (data: BudgetData, mapping: PdfFieldMapping) => string;
  AVAILABLE_FIELDS: Array<{ id: string; label: string }>;
}

const DraggableFieldOverlay: React.FC<DraggableFieldOverlayProps> = ({
  mapping,
  data,
  pageScale,
  getFieldValue,
  AVAILABLE_FIELDS,
}) => {
  const fieldValue = getFieldValue(data, mapping);
  const fieldLabel = mapping.label || AVAILABLE_FIELDS.find(f => f.id === mapping.fieldId)?.label || mapping.fieldId;

  // Map font family to CSS class
  const getFontFamilyClass = (fontFamily?: string) => {
    switch (fontFamily) {
      case 'geist':
        return 'font-geist';
      case 'manrope':
        return 'font-manrope';
      case 'redhatmono':
        return 'font-mono';
      case 'barlow':
        return '';
      default:
        return 'font-geist';
    }
  };

  const fontFamilyClass = getFontFamilyClass(mapping.fontFamily);

  return (
    <div
      className={`inline-block pointer-events-none ${fontFamilyClass}`}
      style={{
        fontSize: mapping.fontSize ? `${mapping.fontSize * pageScale}px` : '12px',
        color: mapping.color || '#000000',
        textAlign: mapping.align || 'left',
        fontWeight: mapping.bold ? 'bold' : 'normal',
        backgroundColor: 'rgba(82, 221, 235, 0.25)',
        border: '2px solid #52ddeb',
        padding: '3px 6px',
        borderRadius: 'var(--radius)',
        boxShadow: '0 8px 24px rgba(82, 221, 235, 0.5)',
        transform: 'scale(1.1)',
        opacity: 0.95,
        whiteSpace: 'nowrap',
      }}
    >
      {fieldValue || `[${fieldLabel}]`}
    </div>
  );
};

