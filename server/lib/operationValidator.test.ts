/**
 * OperationValidator Unit Tests
 * Run with: npm test server/lib/operationValidator.test.ts
 */

import { describe, it, expect } from 'vitest';
import { operationValidator } from './operationValidator';

describe('OperationValidator', () => {
  it('should accept valid CREATE_FRAME operation', () => {
    const op = {
      type: 'CREATE_FRAME',
      props: {
        name: 'Frame 1',
        width: 1440,
        height: 900,
      },
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject CREATE_FRAME without required fields', () => {
    const op = {
      type: 'CREATE_FRAME',
      props: {
        name: 'Frame 1',
        // Missing width and height
      },
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject operation with negative width', () => {
    const op = {
      type: 'CREATE_RECTANGLE',
      props: {
        name: 'Rectangle',
        width: -100,
        height: 200,
      },
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
  });

  it('should accept valid SET_FILL operation', () => {
    const op = {
      type: 'SET_FILL',
      nodeId: '123:456',
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0 },
        },
      ],
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject SET_FILL with empty fills array', () => {
    const op = {
      type: 'SET_FILL',
      nodeId: '123:456',
      fills: [],
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
  });

  it('should accept valid CREATE_TEXT operation', () => {
    const op = {
      type: 'CREATE_TEXT',
      props: {
        content: 'Hello World',
        fontFamily: 'Inter',
        fontSize: 16,
      },
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject CREATE_TEXT with missing content', () => {
    const op = {
      type: 'CREATE_TEXT',
      props: {
        fontFamily: 'Inter',
        fontSize: 16,
      },
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('content'))).toBe(true);
  });

  it('should reject unknown operation type', () => {
    const op = {
      type: 'UNKNOWN_OPERATION',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown'))).toBe(true);
  });

  it('should accept valid RENAME operation', () => {
    const op = {
      type: 'RENAME',
      nodeId: '123:456',
      name: 'New Name',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject RENAME with long name', () => {
    const op = {
      type: 'RENAME',
      nodeId: '123:456',
      name: 'a'.repeat(1001), // Exceeds 1000 char limit
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds'))).toBe(true);
  });

  it('should accept valid SET_OPACITY operation', () => {
    const op = {
      type: 'SET_OPACITY',
      nodeId: '123:456',
      opacity: 0.5,
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject SET_OPACITY with invalid value', () => {
    const op = {
      type: 'SET_OPACITY',
      nodeId: '123:456',
      opacity: 1.5, // Out of 0-1 range
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('0 and 1'))).toBe(true);
  });

  it('should validate batch operations', () => {
    const operations = [
      {
        type: 'CREATE_RECTANGLE',
        props: { name: 'Rect', width: 100, height: 100 },
      },
      {
        type: 'RENAME',
        nodeId: '123:456',
        name: 'Renamed',
      },
      {
        type: 'SET_FILL',
        nodeId: 'invalid', // Invalid: missing fills
        fills: [],
      },
    ];

    const result = operationValidator.validateBatch(operations);

    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].op.type).toBe('SET_FILL');
  });

  it('should accept valid BOOLEAN_OPERATION', () => {
    const op = {
      type: 'BOOLEAN_OPERATION',
      nodeIds: ['id1', 'id2'],
      operation: 'UNION',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject BOOLEAN_OPERATION with invalid operation type', () => {
    const op = {
      type: 'BOOLEAN_OPERATION',
      nodeIds: ['id1', 'id2'],
      operation: 'INVALID_OP',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid operation'))).toBe(true);
  });

  it('should accept valid GROUP_NODES operation', () => {
    const op = {
      type: 'GROUP_NODES',
      nodeIds: ['id1', 'id2', 'id3'],
      name: 'Group',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject GROUP_NODES with less than 2 nodes', () => {
    const op = {
      type: 'GROUP_NODES',
      nodeIds: ['id1'],
      name: 'Group',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least 2'))).toBe(true);
  });

  it('should accept MESSAGE operation (text-only)', () => {
    const op = {
      type: 'MESSAGE',
      content: 'This is a message',
    };

    const result = operationValidator.validate(op);
    expect(result.valid).toBe(true);
  });

  it('should reject operation with null', () => {
    const result = operationValidator.validate(null as any);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('null or undefined');
  });
});
