import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentParserService } from '../src/services/DocumentParserService';

// Mock the external libraries
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn()
  }
}));

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_csv: vi.fn()
  }
}));

vi.mock('csv-parser', () => ({
  default: vi.fn()
}));

vi.mock('node-html-parser', () => ({
  parse: vi.fn()
}));

vi.mock('ical.js', () => ({
  default: {
    parse: vi.fn(),
    Component: vi.fn(),
    Event: vi.fn()
  }
}));

vi.mock('xml2js', () => ({
  parseString: vi.fn()
}));

vi.mock('rtf-parser', () => ({
  default: {
    parseRTF: vi.fn()
  }
}));

vi.mock('officeparser', () => ({
  default: {
    parseOfficeAsync: vi.fn()
  }
}));

describe('DocumentParserService', () => {
  let service: DocumentParserService;

  beforeEach(() => {
    service = new DocumentParserService();
    service.resetStats();
  });

  describe('Statistics tracking', () => {
    it('should initialize with empty statistics', () => {
      const stats = service.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulParses).toBe(0);
      expect(stats.failedParses).toBe(0);
      expect(stats.fallbacksUsed).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.errorsByType).toEqual({});
    });

    it('should reset statistics correctly', () => {
      // Manually set some stats
      const stats = service.getStats();
      stats.totalAttempts = 5;
      stats.successfulParses = 3;
      
      service.resetStats();
      
      const resetStats = service.getStats();
      expect(resetStats.totalAttempts).toBe(0);
      expect(resetStats.successfulParses).toBe(0);
    });
  });

  describe('File extension detection', () => {
    it('should detect file extensions correctly', () => {
      // Test through parseDocument method with mock files
      const testCases = [
        { name: 'test.docx', expectedFormat: 'Word Document' },
        { name: 'test.xlsx', expectedFormat: 'Spreadsheet' },
        { name: 'test.csv', expectedFormat: 'CSV' },
        { name: 'test.html', expectedFormat: 'HTML' },
        { name: 'test.json', expectedFormat: 'JSON' },
        { name: 'test.xml', expectedFormat: 'XML' },
        { name: 'test.rtf', expectedFormat: 'RTF' },
        { name: 'test.ics', expectedFormat: 'Calendar (ICS)' }
      ];

      testCases.forEach(({ name, expectedFormat }) => {
        expect(name.includes(expectedFormat.toLowerCase().split(' ')[0])).toBeTruthy();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle parsing failures gracefully', async () => {
      // Create a mock file that will cause parsing to fail
      const mockFile = new File(['invalid content'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      // Mock mammoth to throw an error
      const mammoth = await import('mammoth');
      vi.mocked(mammoth.default.extractRawText).mockRejectedValue(new Error('Parsing failed'));
      
      // Mock officeparser to also fail
      const officeParser = await import('officeparser');
      vi.mocked(officeParser.default.parseOfficeAsync).mockRejectedValue(new Error('Fallback failed'));

      try {
        await service.parseDocument(mockFile);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to parse document');
      }

      const stats = service.getStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.failedParses).toBe(1);
    });

    it('should use fallback when primary parser fails', async () => {
      const mockFile = new File(['test content'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
      // Mock mammoth to fail
      const mammoth = await import('mammoth');
      vi.mocked(mammoth.default.extractRawText).mockRejectedValue(new Error('Primary parser failed'));
      
      // Mock officeparser to succeed
      const officeParser = await import('officeparser');
      vi.mocked(officeParser.default.parseOfficeAsync).mockResolvedValue('Fallback content');

      const result = await service.parseDocument(mockFile);
      
      expect(result.text).toBe('Fallback content');
      expect(result.metadata?.fallbackUsed).toBe(true);
      
      const stats = service.getStats();
      expect(stats.fallbacksUsed).toBe(1);
    });
  });

  describe('JSON parsing', () => {
    it('should parse valid JSON files', async () => {
      const jsonContent = JSON.stringify({ name: 'test', value: 123 });
      const mockFile = new File([jsonContent], 'test.json', { type: 'application/json' });

      const result = await service.parseDocument(mockFile);
      
      expect(result.metadata?.format).toBe('JSON');
      expect(result.text).toContain('"name": "test"');
      expect(result.text).toContain('"value": 123');
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{ invalid json }';
      const mockFile = new File([invalidJson], 'test.json', { type: 'application/json' });

      try {
        await service.parseDocument(mockFile);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid JSON');
      }
    });
  });

  describe('HTML parsing', () => {
    it('should parse HTML files and extract text', async () => {
      const htmlContent = '<html><head><title>Test Page</title></head><body><h1>Hello World</h1><p>This is a test.</p></body></html>';
      const mockFile = new File([htmlContent], 'test.html', { type: 'text/html' });

      // Mock the HTML parser
      const { parse } = await import('node-html-parser');
      const mockRoot = {
        querySelector: vi.fn().mockReturnValue({ text: 'Test Page' }),
        querySelectorAll: vi.fn().mockReturnValue([]),
        text: 'Hello World This is a test.'
      };
      vi.mocked(parse).mockReturnValue(mockRoot as any);

      const result = await service.parseDocument(mockFile);
      
      expect(result.metadata?.format).toBe('HTML');
      expect(result.metadata?.title).toBe('Test Page');
      expect(result.text).toBe('Hello World This is a test.');
    });
  });

  describe('CSV parsing', () => {
    it('should parse CSV files correctly', async () => {
      const csvContent = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles';
      const mockFile = new File([csvContent], 'test.csv', { type: 'text/csv' });

      // Mock csv-parser
      const csvParser = await import('csv-parser');
      const mockParser = {
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback({ name: 'John', age: '30', city: 'New York' });
            callback({ name: 'Jane', age: '25', city: 'Los Angeles' });
          } else if (event === 'end') {
            callback();
          }
          return mockParser;
        }),
        pipe: vi.fn().mockReturnValue(mockParser)
      };
      vi.mocked(csvParser.default).mockReturnValue(mockParser as any);

      const result = await service.parseDocument(mockFile);
      
      expect(result.metadata?.format).toBe('CSV');
      expect(result.metadata?.rows).toBe(2);
      expect(result.metadata?.columns).toBe(3);
      expect(result.text).toContain('Headers: name, age, city');
      expect(result.text).toContain('John');
      expect(result.text).toContain('Jane');
    });
  });

  describe('Performance tracking', () => {
    it('should track processing time', async () => {
      const mockFile = new File(['test'], 'test.json', { type: 'application/json' });
      
      const result = await service.parseDocument(mockFile);
      
      expect(result.metadata?.processingTime).toBeGreaterThan(0);
      
      const stats = service.getStats();
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });
});
