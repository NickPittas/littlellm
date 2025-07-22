import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chatService } from '../../src/services/chatService';

// Mock the DocumentParserService
vi.mock('../../src/services/DocumentParserService', () => ({
  documentParserService: {
    parseDocument: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      totalAttempts: 0,
      successfulParses: 0,
      failedParses: 0,
      fallbacksUsed: 0,
      averageProcessingTime: 0,
      errorsByType: {}
    }),
    resetStats: vi.fn()
  }
}));

describe('File Attachment Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text extraction from various file types', () => {
    it('should extract text from Word documents', async () => {
      const mockFile = new File(['mock docx content'], 'test.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      // Mock the document parser to return successful result
      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: 'This is the extracted text from the Word document.',
        metadata: {
          format: 'Word Document',
          title: 'test.docx',
          success: true,
          processingTime: 150
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('Word Document: test.docx');
      expect(result).toContain('✅ Parsing Status: Success');
      expect(result).toContain('Processing Time: 150ms');
      expect(result).toContain('This is the extracted text from the Word document.');
    });

    it('should extract text from Excel spreadsheets', async () => {
      const mockFile = new File(['mock xlsx content'], 'test.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: '=== Sheet: Sheet1 ===\nName,Age,City\nJohn,30,NYC\nJane,25,LA',
        metadata: {
          format: 'Spreadsheet',
          title: 'test.xlsx',
          sheets: ['Sheet1'],
          sheetCount: 1,
          success: true,
          processingTime: 200
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('Spreadsheet: test.xlsx');
      expect(result).toContain('Sheets: Sheet1');
      expect(result).toContain('Name,Age,City');
    });

    it('should extract text from PowerPoint presentations', async () => {
      const mockFile = new File(['mock pptx content'], 'presentation.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: 'Slide 1: Introduction\nSlide 2: Main Content\nSlide 3: Conclusion',
        metadata: {
          format: 'PowerPoint',
          title: 'presentation.pptx',
          success: true,
          processingTime: 300
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('PowerPoint: presentation.pptx');
      expect(result).toContain('Slide 1: Introduction');
      expect(result).toContain('Slide 2: Main Content');
    });

    it('should handle CSV files', async () => {
      const mockFile = new File(['name,age\nJohn,30\nJane,25'], 'data.csv', { 
        type: 'text/csv' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: 'Headers: name, age\n\nRow 1:\n  name: John\n  age: 30\n\nRow 2:\n  name: Jane\n  age: 25',
        metadata: {
          format: 'CSV',
          title: 'data.csv',
          rows: 2,
          columns: 2,
          headers: ['name', 'age'],
          success: true,
          processingTime: 50
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('CSV: data.csv');
      expect(result).toContain('Headers: name, age');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
    });

    it('should handle JSON files', async () => {
      const jsonContent = JSON.stringify({ users: [{ name: 'John', age: 30 }] });
      const mockFile = new File([jsonContent], 'data.json', { 
        type: 'application/json' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: '{\n  "users": [\n    {\n      "name": "John",\n      "age": 30\n    }\n  ]\n}',
        metadata: {
          format: 'JSON',
          title: 'data.json',
          type: 'Object',
          size: 1,
          success: true,
          processingTime: 25
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('JSON: data.json');
      expect(result).toContain('"users"');
      expect(result).toContain('"name": "John"');
    });

    it('should handle HTML files', async () => {
      const htmlContent = '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
      const mockFile = new File([htmlContent], 'page.html', { 
        type: 'text/html' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: 'Hello',
        metadata: {
          format: 'HTML',
          title: 'Test',
          originalTitle: 'page.html',
          success: true,
          processingTime: 75
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('HTML: page.html');
      expect(result).toContain('Title: Test');
      expect(result).toContain('Hello');
    });
  });

  describe('Error handling and fallbacks', () => {
    it('should handle parsing failures with fallback', async () => {
      const mockFile = new File(['corrupted content'], 'corrupted.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: '[Document: corrupted.docx]\nFile Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\nFile Size: 1KB\nExtension: .docx\n\nError: Parsing failed\n\nNote: Document parsing failed. Please describe the content you\'d like me to analyze.',
        metadata: {
          format: 'Fallback',
          title: 'corrupted.docx',
          success: false,
          error: 'Parsing failed',
          fallbackUsed: true,
          processingTime: 100
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('Fallback: corrupted.docx');
      expect(result).toContain('⚠️ Parsing Status: Failed (using fallback)');
      expect(result).toContain('Error: Parsing failed');
      expect(result).toContain('Document parsing failed');
    });

    it('should handle complete parsing failure', async () => {
      const mockFile = new File(['invalid'], 'invalid.unknown', { 
        type: 'application/unknown' 
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockRejectedValue(new Error('Unsupported file type'));

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('Error: Failed to parse document - Unsupported file type');
      expect(result).toContain('Please describe the content you\'d like me to analyze');
    });
  });

  describe('Plain text files', () => {
    it('should handle plain text files directly', async () => {
      const textContent = 'This is a plain text file.\nWith multiple lines.';
      const mockFile = new File([textContent], 'readme.txt', { 
        type: 'text/plain' 
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toBe(textContent);
    });

    it('should handle markdown files directly', async () => {
      const markdownContent = '# Title\n\nThis is **bold** text.';
      const mockFile = new File([markdownContent], 'readme.md', { 
        type: 'text/markdown' 
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toBe(markdownContent);
    });
  });

  describe('PDF files', () => {
    it('should skip PDF text extraction and let providers handle directly', async () => {
      const mockFile = new File(['pdf content'], 'document.pdf', { 
        type: 'application/pdf' 
      });

      const result = await chatService.extractTextFromFile(mockFile);
      
      expect(result).toContain('[PDF Document: document.pdf');
      expect(result).toContain('PDF will be processed by the AI provider directly');
    });
  });

  describe('Statistics tracking', () => {
    it('should provide parsing statistics', () => {
      const stats = chatService.getDocumentParsingStats();

      expect(stats).toHaveProperty('totalAttempts');
      expect(stats).toHaveProperty('successfulParses');
      expect(stats).toHaveProperty('failedParses');
      expect(stats).toHaveProperty('fallbacksUsed');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('errorsByType');
    });

    it('should allow resetting statistics', () => {
      chatService.resetDocumentParsingStats();
      // Should not throw an error
      expect(true).toBe(true);
    });
  });

  describe('Provider-specific file handling', () => {
    it('should handle files differently based on provider capabilities', async () => {
      const mockFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf'
      });

      // Test PDF handling - should skip parsing and let provider handle
      const result = await chatService.extractTextFromFile(mockFile);

      expect(result).toContain('PDF will be processed by the AI provider directly');
    });

    it('should process unsupported formats with document parser', async () => {
      const mockFile = new File(['test'], 'test.rtf', {
        type: 'application/rtf'
      });

      const { documentParserService } = await import('../../src/services/DocumentParserService');
      vi.mocked(documentParserService.parseDocument).mockResolvedValue({
        text: 'RTF content extracted successfully',
        metadata: {
          format: 'RTF',
          title: 'test.rtf',
          success: true,
          processingTime: 120
        }
      });

      const result = await chatService.extractTextFromFile(mockFile);

      expect(result).toContain('RTF: test.rtf');
      expect(result).toContain('RTF content extracted successfully');
    });
  });
});
