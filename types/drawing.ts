/**
 * Tipos compartilhados para funcionalidades de desenho
 */

export type DrawingType = 'freehand' | 'text' | 'shape';
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow';

/**
 * Propriedades comuns de desenho
 */
export interface BaseDrawingProps {
  color: string;
  size: number;
}

/**
 * Propriedades de texto
 */
export interface TextDrawingProps extends BaseDrawingProps {
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

/**
 * Propriedades de forma
 */
export interface ShapeDrawingProps extends BaseDrawingProps {
  shapeType: ShapeType;
  shapeWidth?: number;
  shapeHeight?: number;
  shapeColor?: string;
  shapeStrokeColor?: string;
  shapeStrokeWidth?: number;
  shapeFill?: boolean;
}

/**
 * Bounds de um desenho
 */
export interface DrawingBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Propriedades completas de um desenho
 */
export interface DrawingData extends BaseDrawingProps {
  type: DrawingType;
  bounds: DrawingBounds;
  
  // Freehand
  points?: number[][];
  pathData?: string;
  
  // Text
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  
  // Shape
  shapeType?: ShapeType;
  shapeWidth?: number;
  shapeHeight?: number;
  shapeColor?: string;
  shapeStrokeColor?: string;
  shapeStrokeWidth?: number;
  shapeFill?: boolean;
}





