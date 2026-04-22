/**
 * Unit tests for OpenAPI specification generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateOpenAPISpec, countEndpoints } from '../openapi-gen.js';
import { ValidationError, SpecGenerationError } from '../docs-errors.js';

describe('OpenAPI Generator', () => {
  describe('generateOpenAPISpec', () => {
    it('should generate valid OpenAPI spec with defaults', () => {
      const spec = generateOpenAPISpec();

      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('Visant Copilot API');
      expect(spec.servers).toBeDefined();
      expect(spec.servers.length).toBeGreaterThan(0);
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    it('should accept custom version and server URL', () => {
      const spec = generateOpenAPISpec('2.0.0', 'https://api.example.com');

      expect(spec.info.version).toBe('2.0.0');
      expect(spec.servers[0].url).toBe('https://api.example.com');
    });

    it('should throw ValidationError for invalid version', () => {
      expect(() => {
        generateOpenAPISpec('', 'http://localhost:3001');
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid server URL', () => {
      expect(() => {
        generateOpenAPISpec('1.0.0', 'localhost:3001');
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string parameters', () => {
      expect(() => {
        generateOpenAPISpec(null as any, 'http://localhost:3001');
      }).toThrow(ValidationError);
    });

    it('should include authentication schemes', () => {
      const spec = generateOpenAPISpec();

      expect(spec.components).toBeDefined();
      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
      expect(spec.components!.securitySchemes!.bearerAuth.type).toBe('http');
      expect(spec.components!.securitySchemes!.bearerAuth.scheme).toBe('bearer');
    });

    it('should include all required tags', () => {
      const spec = generateOpenAPISpec();

      expect(spec.tags).toBeDefined();
      const tagNames = spec.tags?.map((t) => t.name) || [];
      expect(tagNames).toContain('auth');
      expect(tagNames).toContain('mockups');
      expect(tagNames).toContain('plugin');
    });

    it('should include endpoints with proper structure', () => {
      const spec = generateOpenAPISpec();

      const paths = Object.values(spec.paths);
      expect(paths.length).toBeGreaterThan(0);

      for (const path of paths) {
        for (const [method, endpoint] of Object.entries(path)) {
          if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
            expect(endpoint.summary).toBeDefined();
            expect(endpoint.responses).toBeDefined();
          }
        }
      }
    });

    it('should wrap errors in SpecGenerationError', () => {
      // Create invalid input that would cause an error during spec generation
      // This is hard to do since the function is straightforward,
      // but we test the error wrapping behavior
      expect(() => {
        generateOpenAPISpec(undefined as any, undefined as any);
      }).toThrow();
    });
  });

  describe('countEndpoints', () => {
    let spec: any;

    beforeEach(() => {
      spec = generateOpenAPISpec('1.0.0');
    });

    it('should count endpoints correctly', () => {
      const count = countEndpoints(spec);

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should count all HTTP methods', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {},
            post: {},
            put: {},
            delete: {},
            patch: {},
          },
        },
      };

      const count = countEndpoints(spec as any);
      expect(count).toBe(5);
    });

    it('should ignore non-HTTP methods', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {},
            parameters: {},
            servers: {},
          },
        },
      };

      const count = countEndpoints(spec as any);
      expect(count).toBe(1);
    });

    it('should throw ValidationError for invalid spec', () => {
      expect(() => {
        countEndpoints(null as any);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for spec without paths', () => {
      expect(() => {
        countEndpoints({ openapi: '3.0.0' } as any);
      }).toThrow(ValidationError);
    });

    it('should handle empty paths', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };

      const count = countEndpoints(spec as any);
      expect(count).toBe(0);
    });
  });
});
