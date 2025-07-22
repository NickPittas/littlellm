import { describe, it, expect } from 'vitest';
import { PROVIDER_CAPABILITIES } from '../../src/services/providers/constants';

describe('Provider Capabilities', () => {
  const expectedProviders = [
    'openai',
    'anthropic', 
    'gemini',
    'mistral',
    'deepseek',
    'lmstudio',
    'ollama',
    'openrouter',
    'requesty',
    'replicate',
    'n8n'
  ];

  describe('Provider configuration completeness', () => {
    it('should have capabilities defined for all expected providers', () => {
      expectedProviders.forEach(providerId => {
        expect(PROVIDER_CAPABILITIES).toHaveProperty(providerId);
      });
    });

    it('should have all required capability properties for each provider', () => {
      const requiredProperties = [
        'supportsVision',
        'supportsTools', 
        'supportsStreaming',
        'supportsSystemMessages',
        'maxToolNameLength',
        'toolFormat',
        'nativeDocumentSupport',
        'documentParsingRequired'
      ];

      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        
        requiredProperties.forEach(property => {
          expect(capabilities).toHaveProperty(property);
        });
      });
    });
  });

  describe('Document support configuration', () => {
    it('should have valid document support arrays', () => {
      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        
        expect(Array.isArray(capabilities.nativeDocumentSupport)).toBe(true);
        expect(Array.isArray(capabilities.documentParsingRequired)).toBe(true);
      });
    });

    it('should not have overlapping native and parsing required formats', () => {
      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        const native = capabilities.nativeDocumentSupport as string[];
        const parsing = capabilities.documentParsingRequired as string[];
        
        // Check for overlaps
        const overlap = native.filter(format => parsing.includes(format));
        expect(overlap).toEqual([]);
      });
    });

    it('should have comprehensive format coverage', () => {
      const allSupportedFormats = [
        'pdf', 'txt', 'md', 'docx', 'doc', 'xlsx', 'xls', 'ods', 
        'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf'
      ];

      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        const native = capabilities.nativeDocumentSupport as string[];
        const parsing = capabilities.documentParsingRequired as string[];
        const combined = [...native, ...parsing];
        
        // Each provider should support most common formats
        const commonFormats = ['pdf', 'txt', 'docx', 'xlsx', 'csv', 'json'];
        commonFormats.forEach(format => {
          expect(combined).toContain(format);
        });
      });
    });
  });

  describe('Provider-specific capabilities', () => {
    it('should have Mistral with comprehensive native support', () => {
      const mistral = PROVIDER_CAPABILITIES.mistral;
      const native = mistral.nativeDocumentSupport as string[];
      
      // Mistral should have the most comprehensive native support
      expect(native).toContain('pdf');
      expect(native).toContain('docx');
      expect(native).toContain('xlsx');
      expect(native).toContain('pptx');
      expect(native).toContain('csv');
      expect(native).toContain('json');
    });

    it('should have Anthropic with good document support', () => {
      const anthropic = PROVIDER_CAPABILITIES.anthropic;
      const native = anthropic.nativeDocumentSupport as string[];
      
      expect(native).toContain('pdf');
      expect(native).toContain('txt');
      expect(native).toContain('csv');
    });

    it('should have OpenAI with Assistants API support', () => {
      const openai = PROVIDER_CAPABILITIES.openai;
      const native = openai.nativeDocumentSupport as string[];
      
      expect(native).toContain('pdf');
      expect(native).toContain('txt');
      expect(native).toContain('md');
    });

    it('should have limited providers with minimal native support', () => {
      const limitedProviders = ['deepseek', 'replicate', 'n8n'];
      
      limitedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        const native = capabilities.nativeDocumentSupport as string[];
        
        // These providers should have minimal or no native support
        expect(native.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Tool format configuration', () => {
    it('should have valid tool formats', () => {
      const validFormats = ['openai', 'anthropic', 'gemini', 'custom'];
      
      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        
        expect(validFormats).toContain(capabilities.toolFormat);
      });
    });

    it('should have appropriate tool name length limits', () => {
      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        
        if (capabilities.maxToolNameLength !== undefined) {
          expect(capabilities.maxToolNameLength).toBeGreaterThan(0);
          expect(capabilities.maxToolNameLength).toBeLessThanOrEqual(256);
        }
      });
    });
  });

  describe('Vision and streaming support', () => {
    it('should have most providers supporting vision', () => {
      const visionProviders = expectedProviders.filter(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        return capabilities.supportsVision;
      });
      
      // Most modern providers should support vision
      expect(visionProviders.length).toBeGreaterThan(6);
    });

    it('should have most providers supporting streaming', () => {
      const streamingProviders = expectedProviders.filter(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        return capabilities.supportsStreaming;
      });
      
      // Most providers should support streaming
      expect(streamingProviders.length).toBeGreaterThan(8);
    });

    it('should have most providers supporting tools', () => {
      const toolProviders = expectedProviders.filter(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        return capabilities.supportsTools;
      });
      
      // Most providers should support tools
      expect(toolProviders.length).toBeGreaterThan(7);
    });
  });

  describe('Configuration consistency', () => {
    it('should have consistent boolean types', () => {
      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        
        expect(typeof capabilities.supportsVision).toBe('boolean');
        expect(typeof capabilities.supportsTools).toBe('boolean');
        expect(typeof capabilities.supportsStreaming).toBe('boolean');
        expect(typeof capabilities.supportsSystemMessages).toBe('boolean');
      });
    });

    it('should have valid tool format strings', () => {
      expectedProviders.forEach(providerId => {
        const capabilities = PROVIDER_CAPABILITIES[providerId as keyof typeof PROVIDER_CAPABILITIES];
        
        expect(typeof capabilities.toolFormat).toBe('string');
        expect(capabilities.toolFormat.length).toBeGreaterThan(0);
      });
    });
  });
});
