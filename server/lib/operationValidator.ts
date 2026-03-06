/**
 * OperationValidator — Schema validation for Figma operations
 * Validates operations before pushing to plugin (fail-fast principle)
 */

import type { Operation } from './pluginBridge.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates Figma design operations
 */
class OperationValidator {
  /**
   * Validate a single operation
   */
  validate(op: Operation): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!op) {
      errors.push('Operation is null or undefined');
      return { valid: false, errors };
    }

    if (!op.type) {
      errors.push('Missing operation type');
      return { valid: false, errors };
    }

    if (typeof op.type !== 'string') {
      errors.push('Invalid operation type (must be string)');
      return { valid: false, errors };
    }

    // Type-specific validation
    switch (op.type) {
      case 'MESSAGE': {
        if (!op.content) errors.push('MESSAGE requires content field');
        if (typeof op.content !== 'string')
          errors.push('MESSAGE content must be string');
        break;
      }

      case 'CREATE_FRAME':
      case 'CREATE_RECTANGLE':
      case 'CREATE_ELLIPSE': {
        if (!op.props) {
          errors.push(`${op.type} requires props object`);
          break;
        }
        const props = op.props;
        if (!props.name) errors.push(`${op.type} requires props.name`);
        if (typeof props.width !== 'number')
          errors.push(`${op.type} requires props.width (number)`);
        if (typeof props.height !== 'number')
          errors.push(`${op.type} requires props.height (number)`);
        if (props.width && props.width <= 0)
          errors.push(`${op.type} width must be positive`);
        if (props.height && props.height <= 0)
          errors.push(`${op.type} height must be positive`);
        break;
      }

      case 'CREATE_TEXT': {
        if (!op.parentRef && !op.parentNodeId) {
          // Parent is optional (defaults to page root), but warn
          console.warn('[Validator] CREATE_TEXT has no parent specified');
        }
        if (!op.props) {
          errors.push('CREATE_TEXT requires props object');
          break;
        }
        const props = op.props;
        if (!props.content) errors.push('CREATE_TEXT requires props.content');
        if (typeof props.content !== 'string')
          errors.push('CREATE_TEXT content must be string');
        if (props.content && props.content.length > 50000)
          errors.push('CREATE_TEXT content exceeds max length (50000 chars)');
        break;
      }

      case 'CREATE_COMPONENT_INSTANCE': {
        if (!op.componentKey) errors.push('CREATE_COMPONENT_INSTANCE requires componentKey');
        if (!op.props?.name) errors.push('CREATE_COMPONENT_INSTANCE requires props.name');
        break;
      }

      case 'SET_FILL': {
        if (!op.nodeId) errors.push('SET_FILL requires nodeId');
        if (!op.fills || !Array.isArray(op.fills)) {
          errors.push('SET_FILL requires fills array');
          break;
        }
        if (op.fills.length === 0) errors.push('SET_FILL fills array cannot be empty');
        break;
      }

      case 'SET_STROKE': {
        if (!op.nodeId) errors.push('SET_STROKE requires nodeId');
        if (!op.strokes || !Array.isArray(op.strokes)) {
          errors.push('SET_STROKE requires strokes array');
        }
        if (typeof op.strokeWeight !== 'undefined' && op.strokeWeight < 0) {
          errors.push('SET_STROKE strokeWeight must be non-negative');
        }
        break;
      }

      case 'SET_CORNER_RADIUS': {
        if (!op.nodeId) errors.push('SET_CORNER_RADIUS requires nodeId');
        if (typeof op.cornerRadius !== 'number') {
          errors.push('SET_CORNER_RADIUS requires cornerRadius (number)');
        }
        if (op.cornerRadius && op.cornerRadius < 0) {
          errors.push('SET_CORNER_RADIUS must be non-negative');
        }
        break;
      }

      case 'SET_EFFECTS': {
        if (!op.nodeId) errors.push('SET_EFFECTS requires nodeId');
        if (!Array.isArray(op.effects)) {
          errors.push('SET_EFFECTS requires effects array');
        }
        break;
      }

      case 'SET_AUTO_LAYOUT': {
        if (!op.nodeId) errors.push('SET_AUTO_LAYOUT requires nodeId');
        if (!op.layoutMode) {
          errors.push('SET_AUTO_LAYOUT requires layoutMode (HORIZONTAL or VERTICAL)');
        } else if (!['HORIZONTAL', 'VERTICAL'].includes(op.layoutMode)) {
          errors.push(`SET_AUTO_LAYOUT invalid layoutMode: ${op.layoutMode}. Must be HORIZONTAL or VERTICAL`);
        }
        break;
      }

      case 'RESIZE': {
        if (!op.nodeId) errors.push('RESIZE requires nodeId');
        if (typeof op.width !== 'number') errors.push('RESIZE requires width (number)');
        if (typeof op.height !== 'number')
          errors.push('RESIZE requires height (number)');
        if (op.width && op.width <= 0) errors.push('RESIZE width must be positive');
        if (op.height && op.height <= 0) errors.push('RESIZE height must be positive');
        break;
      }

      case 'MOVE': {
        if (!op.nodeId) errors.push('MOVE requires nodeId');
        if (typeof op.x !== 'number') errors.push('MOVE requires x (number)');
        if (typeof op.y !== 'number') errors.push('MOVE requires y (number)');
        break;
      }

      case 'RENAME': {
        if (!op.nodeId) errors.push('RENAME requires nodeId');
        if (!op.name) errors.push('RENAME requires name');
        if (typeof op.name !== 'string') errors.push('RENAME name must be string');
        if (op.name && op.name.length > 1000)
          errors.push('RENAME name exceeds max length (1000 chars)');
        break;
      }

      case 'SET_TEXT_CONTENT': {
        if (!op.nodeId) errors.push('SET_TEXT_CONTENT requires nodeId');
        if (!op.content) errors.push('SET_TEXT_CONTENT requires content');
        if (typeof op.content !== 'string')
          errors.push('SET_TEXT_CONTENT content must be string');
        break;
      }

      case 'SET_OPACITY': {
        if (!op.nodeId) errors.push('SET_OPACITY requires nodeId');
        if (typeof op.opacity !== 'number')
          errors.push('SET_OPACITY requires opacity (number)');
        if (op.opacity < 0 || op.opacity > 1) {
          errors.push('SET_OPACITY must be between 0 and 1');
        }
        break;
      }

      case 'APPLY_VARIABLE': {
        if (!op.nodeId) errors.push('APPLY_VARIABLE requires nodeId');
        if (!op.variableId) errors.push('APPLY_VARIABLE requires variableId');
        if (!op.field) errors.push('APPLY_VARIABLE requires field');
        break;
      }

      case 'APPLY_STYLE': {
        if (!op.nodeId) errors.push('APPLY_STYLE requires nodeId');
        if (!op.styleId) errors.push('APPLY_STYLE requires styleId');
        break;
      }

      case 'GROUP_NODES': {
        if (!Array.isArray(op.nodeIds) || op.nodeIds.length < 2) {
          errors.push('GROUP_NODES requires nodeIds array with at least 2 items');
        }
        if (!op.name) errors.push('GROUP_NODES requires name');
        break;
      }

      case 'UNGROUP':
      case 'DETACH_INSTANCE':
      case 'DELETE_NODE': {
        if (!op.nodeId) errors.push(`${op.type} requires nodeId`);
        break;
      }

      case 'SET_IMAGE_FILL': {
        if (!op.nodeId) errors.push('SET_IMAGE_FILL requires nodeId');
        if (!op.imageUrl && !op.imageHash) {
          errors.push('SET_IMAGE_FILL requires imageUrl or imageHash');
        }
        break;
      }

      case 'CREATE_COMPONENT': {
        if (!op.props?.name) errors.push('CREATE_COMPONENT requires props.name');
        break;
      }

      case 'COMBINE_AS_VARIANTS': {
        if (!Array.isArray(op.componentIds) || op.componentIds.length < 2) {
          errors.push('COMBINE_AS_VARIANTS requires componentIds array with at least 2 items');
        }
        break;
      }

      case 'CREATE_SVG': {
        if (!op.props?.svg) errors.push('CREATE_SVG requires props.svg');
        break;
      }

      case 'CREATE_LINE':
      case 'CREATE_POLYGON':
      case 'CREATE_STAR': {
        if (!op.props?.name) errors.push(`${op.type} requires props.name`);
        break;
      }

      case 'SET_TEXT_RANGES': {
        if (!op.nodeId) errors.push('SET_TEXT_RANGES requires nodeId');
        if (!Array.isArray(op.ranges)) {
          errors.push('SET_TEXT_RANGES requires ranges array');
        }
        break;
      }

      case 'CLONE_NODE':
      case 'DUPLICATE_NODE': {
        if (!op.nodeId) errors.push(`${op.type} requires nodeId`);
        // parentRef or parentNodeId is optional (defaults to same parent)
        break;
      }

      case 'REORDER_CHILD': {
        if (!op.nodeId) errors.push('REORDER_CHILD requires nodeId');
        if (typeof op.index !== 'number')
          errors.push('REORDER_CHILD requires index (number)');
        break;
      }

      case 'SET_CONSTRAINTS': {
        if (!op.nodeId) errors.push('SET_CONSTRAINTS requires nodeId');
        if (!op.constraints) errors.push('SET_CONSTRAINTS requires constraints');
        break;
      }

      case 'SET_LAYOUT_GRID': {
        if (!op.nodeId) errors.push('SET_LAYOUT_GRID requires nodeId');
        break;
      }

      case 'CREATE_VARIABLE': {
        if (!op.name) errors.push('CREATE_VARIABLE requires name');
        if (!op.variableType) errors.push('CREATE_VARIABLE requires variableType');
        break;
      }

      case 'SET_BLEND_MODE': {
        if (!op.nodeId) errors.push('SET_BLEND_MODE requires nodeId');
        if (!op.blendMode) errors.push('SET_BLEND_MODE requires blendMode');
        break;
      }

      case 'SET_INDIVIDUAL_CORNERS': {
        if (!op.nodeId) errors.push('SET_INDIVIDUAL_CORNERS requires nodeId');
        break;
      }

      case 'BOOLEAN_OPERATION': {
        if (!Array.isArray(op.nodeIds) || op.nodeIds.length < 2) {
          errors.push('BOOLEAN_OPERATION requires nodeIds array with at least 2 items');
        }
        if (!['UNION', 'SUBTRACT', 'INTERSECT', 'EXCLUDE'].includes(op.operation)) {
          errors.push(
            `BOOLEAN_OPERATION invalid operation: ${op.operation}. Must be UNION, SUBTRACT, INTERSECT, or EXCLUDE`,
          );
        }
        break;
      }

      default:
        errors.push(`Unknown operation type: ${op.type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Batch validate (for efficiency)
   */
  validateBatch(
    operations: Operation[],
  ): {
    valid: Operation[];
    invalid: Array<{ op: Operation; errors: string[] }>;
  } {
    const valid: Operation[] = [];
    const invalid: Array<{ op: Operation; errors: string[] }> = [];

    for (const op of operations) {
      const result = this.validate(op);
      if (result.valid) {
        valid.push(op);
      } else {
        invalid.push({ op, errors: result.errors });
      }
    }

    return { valid, invalid };
  }
}

// Export singleton
export const operationValidator = new OperationValidator();
