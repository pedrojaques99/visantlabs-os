import React from 'react';
import type { BudgetData } from '../../../types';
import type { VisantLayout, VisantElement } from '../../../types/visant';
import { InlineEditor } from '../InlineEditor';

interface VisantPageRendererProps {
  data: BudgetData;
  layout: VisantLayout;
  pageName: 'cover' | 'introduction' | 'budget' | 'gifts' | 'payment' | 'backCover';
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
}

// Helper to get variable value from BudgetData
const getVariableValue = (data: BudgetData, variable?: string): string => {
  if (!variable) return '';
  
  const variableMap: Record<string, any> = {
    brandName: data.brandName,
    year: data.year || '2025',
    finalCTAText: data.finalCTAText || 'VAMOS CONSTRUIR ALGO GRANDE JUNTOS?',
    projectName: data.projectName,
    clientName: data.clientName,
    projectDescription: data.projectDescription,
    accentColor: data.brandAccentColor || data.brandColors[0] || '#52ddeb',
    bgColor: data.brandBackgroundColor || '#151515',
    textColor: data.brandBackgroundColor !== '#ffffff' && data.brandBackgroundColor !== '#fff' && data.brandBackgroundColor !== 'white' ? '#ffffff' : '#000000',
  };

  return variableMap[variable] || '';
};

// Replace variables in content (e.g., {{brandName}})
const replaceVariables = (content: string, data: BudgetData): string => {
  if (!content) return '';
  
  return content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return getVariableValue(data, varName) || match;
  });
};

// Render a single element
const renderElement = (
  element: VisantElement,
  data: BudgetData,
  editable: boolean,
  onDataChange?: (data: Partial<BudgetData>) => void,
  depth: number = 0
): React.ReactNode => {
  const { id, type, content, variable, position, size, styles, editable: elementEditable, children } = element;
  
  const isEditable = elementEditable !== false && editable;
  const elementContent = variable ? getVariableValue(data, variable) : replaceVariables(content || '', data);
  
  const elementStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: position.z || depth,
    width: typeof size.width === 'number' ? `${size.width}px` : size.width,
    height: typeof size.height === 'number' ? `${size.height}px` : size.height,
    fontSize: styles.fontSize ? `${styles.fontSize}px` : undefined,
    color: styles.color,
    fontFamily: styles.fontFamily,
    fontWeight: styles.fontWeight,
    textAlign: styles.textAlign,
    backgroundColor: styles.backgroundColor,
    border: styles.border,
    borderRadius: styles.borderRadius,
    opacity: styles.opacity,
    transform: styles.transform,
    letterSpacing: styles.letterSpacing,
    lineHeight: styles.lineHeight,
    padding: styles.padding,
    margin: styles.margin,
    ...styles,
  };

  if (type === 'container' && children) {
    return (
      <div key={id} style={elementStyle}>
        {children.map((child) => renderElement(child, data, editable, onDataChange, depth + 1))}
      </div>
    );
  }

  if (type === 'text') {
    // Lock system: only allow editing if element is marked as editable AND has a variable
    // Users can only edit variable values, not structure or styles
    if (isEditable && variable && editable) {
      return (
        <div key={id} style={elementStyle}>
          <InlineEditor
            value={elementContent}
            onChange={(newValue) => {
              if (onDataChange && variable) {
                const updates: Partial<BudgetData> = {};
                (updates as any)[variable] = String(newValue);
                onDataChange(updates);
              }
            }}
            editable={true}
            style={elementStyle}
          />
        </div>
      );
    }
    // Non-editable or no variable - just render the content
    return (
      <div key={id} style={elementStyle}>
        {elementContent}
      </div>
    );
  }

  if (type === 'icon' || type === 'shape') {
    return <div key={id} style={elementStyle} />;
  }

  if (type === 'image') {
    return (
      <img
        key={id}
        src={elementContent}
        alt=""
        style={elementStyle}
      />
    );
  }

  return null;
};

export const VisantPageRenderer: React.FC<VisantPageRendererProps> = ({
  data,
  layout,
  pageName,
  editable = false,
  onDataChange,
}) => {
  const pageLayout = layout.pages[pageName];
  if (!pageLayout) {
    return <div>Page layout not found</div>;
  }

  const pageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: pageLayout.styles.backgroundColor || '#151515',
    padding: pageLayout.styles.padding,
    minHeight: pageLayout.styles.minHeight,
  };

  return (
    <div style={pageStyle}>
      {pageLayout.elements.map((element) => renderElement(element, data, editable, onDataChange))}
    </div>
  );
};

