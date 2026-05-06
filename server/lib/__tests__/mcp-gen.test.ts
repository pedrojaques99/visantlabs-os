/**
 * Unit tests for MCP specification generator
 */

import { describe, it, expect } from 'vitest';
import { generateMCPSpec, countMCPTools, getMCPTool } from '../mcp-gen.js';
import { ValidationError } from '../docs-errors.js';

describe('MCP Generator', () => {
  describe('generateMCPSpec', () => {
    it('should generate valid MCP spec', () => {
      const spec = generateMCPSpec();

      expect(spec).toBeDefined();
      expect(spec.name).toBe('figma-mcp');
      expect(spec.version).toBe('1.0.0');
      expect(spec.description).toBeDefined();
      expect(spec.tools).toBeDefined();
      expect(Array.isArray(spec.tools)).toBe(true);
    });

    it('should include all 18 MCP tools', () => {
      const spec = generateMCPSpec();

      expect(spec.tools.length).toBe(18);

      // generateMCPSpec lowercases all tool names from the registry
      const toolNames = spec.tools.map((t) => t.name);
      expect(toolNames).toContain('message');
      expect(toolNames).toContain('get_design_context');
      expect(toolNames).toContain('search_design_system');
      expect(toolNames).toContain('create_frame');
      expect(toolNames).toContain('create_component');
      expect(toolNames).toContain('combine_as_variants');
      expect(toolNames).toContain('create_svg');
      expect(toolNames).toContain('set_image_fill');
      expect(toolNames).toContain('create_rectangle');
      expect(toolNames).toContain('create_text');
      expect(toolNames).toContain('rename');
      expect(toolNames).toContain('delete_node');
      expect(toolNames).toContain('create_component_instance');
      expect(toolNames).toContain('group_nodes');
      expect(toolNames).toContain('set_text_style');
      expect(toolNames).toContain('create_color_variables_from_selection');
      expect(toolNames).toContain('bind_nearest_color_variables');
      expect(toolNames).toContain('request_scan');
    });

    it('should include proper tool structure', () => {
      const spec = generateMCPSpec();

      for (const tool of spec.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);

        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);

        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.inputSchema.required).toBeDefined();
      }
    });

    it('should include examples for each tool', () => {
      const spec = generateMCPSpec();

      for (const tool of spec.tools) {
        expect(tool.examples).toBeDefined();
        expect(Array.isArray(tool.examples)).toBe(true);
        expect(tool.examples!.length).toBeGreaterThan(0);

        for (const example of tool.examples!) {
          expect(example.name).toBeDefined();
          expect(example.input).toBeDefined();
        }
      }
    });

    it('should have valid input schemas', () => {
      const spec = generateMCPSpec();

      for (const tool of spec.tools) {
        const props = tool.inputSchema.properties || {};

        // Check that each property has a type or nested structure
        for (const [propName, propDef] of Object.entries(props)) {
          expect(propDef).toBeDefined();
          expect(typeof propDef).toBe('object');
        }
      }
    });

    it('should have required fields for mandatory parameters', () => {
      const spec = generateMCPSpec();
      const createFrame = spec.tools.find((t) => t.name === 'create_frame');

      expect(createFrame).toBeDefined();
      expect(createFrame?.inputSchema.required).toContain('props');
    });
  });

  describe('countMCPTools', () => {
    it('should count tools correctly', () => {
      const spec = generateMCPSpec();
      const count = countMCPTools(spec);

      expect(count).toBe(18);
    });

    it('should throw ValidationError for invalid spec', () => {
      expect(() => {
        countMCPTools(null as any);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for spec without tools array', () => {
      expect(() => {
        countMCPTools({ name: 'test' } as any);
      }).toThrow(ValidationError);
    });

    it('should return 0 for empty tools array', () => {
      const spec = {
        name: 'test',
        tools: [],
      };

      const count = countMCPTools(spec as any);
      expect(count).toBe(0);
    });
  });

  describe('getMCPTool', () => {
    it('should retrieve tool by name', () => {
      const spec = generateMCPSpec();
      const tool = getMCPTool(spec, 'create_frame');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('create_frame');
      expect(tool?.description).toBeDefined();
    });

    it('should return undefined for non-existent tool', () => {
      const spec = generateMCPSpec();
      const tool = getMCPTool(spec, 'non_existent_tool');

      expect(tool).toBeUndefined();
    });

    it('should throw ValidationError for invalid spec', () => {
      expect(() => {
        getMCPTool(null as any, 'create_frame');
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid tool name', () => {
      const spec = generateMCPSpec();

      expect(() => {
        getMCPTool(spec, '');
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string tool name', () => {
      const spec = generateMCPSpec();

      expect(() => {
        getMCPTool(spec, null as any);
      }).toThrow(ValidationError);
    });

    it('should retrieve all 15 tools individually', () => {
      const spec = generateMCPSpec();
      const toolNames = spec.tools.map((t) => t.name);

      for (const name of toolNames) {
        const tool = getMCPTool(spec, name);
        expect(tool).toBeDefined();
        expect(tool?.name).toBe(name);
      }
    });
  });
});
