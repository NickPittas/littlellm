import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import csvParser from 'csv-parser';
import { parse as parseHtml } from 'node-html-parser';
import ICAL from 'ical.js';
import { parseString as parseXml } from 'xml2js';
import rtfParser from 'rtf-parser';

export interface ParsedDocument {
  text: string;
  metadata?: {
    title?: string;
    author?: string;
    pages?: number;
    sheets?: string[];
    format?: string;
    success?: boolean;
    error?: string;
    fallbackUsed?: boolean;
    processingTime?: number;
    [key: string]: unknown;
  };
}

export interface DocumentParsingStats {
  totalAttempts: number;
  successfulParses: number;
  failedParses: number;
  fallbacksUsed: number;
  averageProcessingTime: number;
  errorsByType: Record<string, number>;
}

export class DocumentParserService {
  private stats: DocumentParsingStats = {
    totalAttempts: 0,
    successfulParses: 0,
    failedParses: 0,
    fallbacksUsed: 0,
    averageProcessingTime: 0,
    errorsByType: {}
  };

  /**
   * Get current parsing statistics
   */
  getStats(): DocumentParsingStats {
    return { ...this.stats };
  }

  /**
   * Reset parsing statistics
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulParses: 0,
      failedParses: 0,
      fallbacksUsed: 0,
      averageProcessingTime: 0,
      errorsByType: {}
    };
  }

  /**
   * Main entry point for parsing any supported document format
   */
  async parseDocument(file: File): Promise<ParsedDocument> {
    const startTime = Date.now();
    const fileExtension = this.getFileExtension(file.name).toLowerCase();
    const mimeType = file.type;

    this.stats.totalAttempts++;
    console.log(`📄 Parsing document: ${file.name} (${fileExtension}, ${mimeType})`);
    console.log(`📄 File size: ${Math.round(file.size / 1024)}KB, Last modified: ${file.lastModified ? new Date(file.lastModified).toISOString() : 'Unknown'}`);

    try {
      let result: ParsedDocument;

      switch (fileExtension) {
        case '.docx':
        case '.doc':
          result = await this.parseWordDocument(file);
          break;

        case '.xlsx':
        case '.xls':
        case '.ods':
          result = await this.parseSpreadsheet(file);
          break;

        case '.csv':
          result = await this.parseCsv(file);
          break;

        case '.html':
        case '.htm':
          result = await this.parseHtml(file);
          break;

        case '.ics':
          result = await this.parseIcs(file);
          break;

        case '.json':
          result = await this.parseJson(file);
          break;

        case '.rtf':
          result = await this.parseRtf(file);
          break;

        case '.xml':
          result = await this.parseXml(file);
          break;

        case '.pptx':
        case '.ppt':
          result = await this.parsePowerPoint(file);
          break;

        default:
          // Create a fallback document for unsupported formats
          console.log('📄 Unsupported format, creating fallback document...');
          result = await this.createFallbackDocument(file, 'Unsupported file format');
          this.stats.fallbacksUsed++;
          break;
      }

      // Success - update statistics
      const processingTime = Date.now() - startTime;
      this.stats.successfulParses++;
      this.updateAverageProcessingTime(processingTime);

      result.metadata = {
        ...result.metadata,
        success: true,
        processingTime
      };

      console.log(`✅ Successfully parsed ${file.name} in ${processingTime}ms`);
      return result;

    } catch (error) {
      // Error handling with fallback
      const processingTime = Date.now() - startTime;
      this.stats.failedParses++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorType = this.categorizeError(error);

      this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;

      console.error(`❌ Error parsing document ${file.name}:`, error);

      // Try fallback approach
      try {
        console.log(`🔄 Attempting fallback parsing for ${file.name}...`);
        const fallbackResult = await this.createFallbackDocument(file, errorMessage);
        this.stats.fallbacksUsed++;

        fallbackResult.metadata = {
          ...fallbackResult.metadata,
          success: false,
          error: errorMessage,
          fallbackUsed: true,
          processingTime
        };

        console.log(`⚠️ Fallback parsing completed for ${file.name}`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error(`❌ Fallback parsing also failed for ${file.name}:`, fallbackError);
        throw new Error(`Failed to parse document: ${errorMessage}. Fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Parse Word documents (.docx, .doc)
   */
  private async parseWordDocument(file: File): Promise<ParsedDocument> {
    try {
      // First, try with ArrayBuffer (more compatible)
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });

      return {
        text: result.value,
        metadata: {
          format: 'Word Document',
          title: file.name,
          warnings: result.messages?.length > 0 ? result.messages.map(m => m.message) : undefined
        }
      };
    } catch (error) {
      console.log('📄 Mammoth failed with ArrayBuffer, trying Buffer approach...', error);

      try {
        // Fallback: try with Buffer
        const buffer = await this.fileToBuffer(file);
        const result = await mammoth.extractRawText({ buffer });

        return {
          text: result.value,
          metadata: {
            format: 'Word Document',
            title: file.name,
            warnings: result.messages?.length > 0 ? result.messages.map(m => m.message) : undefined
          }
        };
      } catch (bufferError) {
        console.log('📄 Mammoth failed with Buffer approach too...', bufferError);

        // Final fallback: create a fallback document with detailed error info
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const bufferErrorMessage = bufferError instanceof Error ? bufferError.message : 'Unknown error';

        return await this.createFallbackDocument(
          file,
          `Word document parsing failed. Primary error: ${errorMessage}. Buffer fallback error: ${bufferErrorMessage}. The file may be corrupted, password-protected, or in an unsupported format.`
        );
      }
    }
  }

  /**
   * Parse spreadsheet files (.xlsx, .xls, .ods)
   */
  private async parseSpreadsheet(file: File): Promise<ParsedDocument> {
    const buffer = await this.fileToBuffer(file);
    
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];
      let combinedText = '';

      workbook.SheetNames.forEach((sheetName) => {
        sheets.push(sheetName);
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        combinedText += `\n\n=== Sheet: ${sheetName} ===\n`;
        combinedText += csvData;
      });

      return {
        text: combinedText.trim(),
        metadata: {
          format: 'Spreadsheet',
          title: file.name,
          sheets: sheets,
          sheetCount: sheets.length
        }
      };
    } catch {
      console.log('📊 XLSX failed, creating fallback document...');
      return await this.createFallbackDocument(file, 'Spreadsheet parsing failed - file may be corrupted or in an unsupported format');
    }
  }

  /**
   * Parse CSV files
   */
  private async parseCsv(file: File): Promise<ParsedDocument> {
    const text = await this.fileToText(file);
    
    return new Promise((resolve, reject) => {
      const rows: Record<string, string>[] = [];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const stream = require('stream');
      const readable = new stream.Readable();
      readable.push(text);
      readable.push(null);

      readable
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => rows.push(row))
        .on('end', () => {
          const headers = Object.keys(rows[0] || {});
          let csvText = `Headers: ${headers.join(', ')}\n\n`;
          
          rows.forEach((row, index) => {
            csvText += `Row ${index + 1}:\n`;
            headers.forEach(header => {
              csvText += `  ${header}: ${row[header]}\n`;
            });
            csvText += '\n';
          });

          resolve({
            text: csvText,
            metadata: {
              format: 'CSV',
              title: file.name,
              rows: rows.length,
              columns: headers.length,
              headers: headers
            }
          });
        })
        .on('error', reject);
    });
  }

  /**
   * Parse HTML files
   */
  private async parseHtml(file: File): Promise<ParsedDocument> {
    const htmlContent = await this.fileToText(file);
    const root = parseHtml(htmlContent);
    
    // Extract title
    const title = root.querySelector('title')?.text || file.name;
    
    // Remove script and style tags
    root.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Extract text content
    const text = root.text;
    
    return {
      text: text,
      metadata: {
        format: 'HTML',
        title: title,
        originalTitle: file.name
      }
    };
  }

  /**
   * Parse ICS calendar files
   */
  private async parseIcs(file: File): Promise<ParsedDocument> {
    const icsContent = await this.fileToText(file);
    
    try {
      const jcalData = ICAL.parse(icsContent);
      const comp = new ICAL.Component(jcalData);
      const events = comp.getAllSubcomponents('vevent');
      
      let calendarText = 'Calendar Events:\n\n';
      
      events.forEach((event, index) => {
        const vevent = new ICAL.Event(event);
        calendarText += `Event ${index + 1}:\n`;
        calendarText += `  Title: ${vevent.summary}\n`;
        calendarText += `  Start: ${vevent.startDate?.toJSDate()}\n`;
        calendarText += `  End: ${vevent.endDate?.toJSDate()}\n`;
        if (vevent.description) {
          calendarText += `  Description: ${vevent.description}\n`;
        }
        if (vevent.location) {
          calendarText += `  Location: ${vevent.location}\n`;
        }
        calendarText += '\n';
      });

      return {
        text: calendarText,
        metadata: {
          format: 'Calendar (ICS)',
          title: file.name,
          eventCount: events.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse ICS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse JSON files
   */
  private async parseJson(file: File): Promise<ParsedDocument> {
    const jsonContent = await this.fileToText(file);
    
    try {
      const jsonData = JSON.parse(jsonContent);
      const formattedJson = JSON.stringify(jsonData, null, 2);
      
      return {
        text: formattedJson,
        metadata: {
          format: 'JSON',
          title: file.name,
          type: Array.isArray(jsonData) ? 'Array' : typeof jsonData,
          size: Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData).length
        }
      };
    } catch (error) {
      throw new Error(`Invalid JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse RTF files
   */
  private async parseRtf(file: File): Promise<ParsedDocument> {
    const rtfContent = await this.fileToText(file);
    
    try {
      const doc = await rtfParser.parseRTF(rtfContent);
      const text = this.extractTextFromRtfDoc(doc);
      
      return {
        text: text,
        metadata: {
          format: 'RTF',
          title: file.name
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse RTF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse XML files
   */
  private async parseXml(file: File): Promise<ParsedDocument> {
    const xmlContent = await this.fileToText(file);
    
    return new Promise((resolve, reject) => {
      parseXml(xmlContent, (err, result) => {
        if (err) {
          reject(new Error(`Failed to parse XML: ${err.message}`));
          return;
        }
        
        const formattedXml = JSON.stringify(result, null, 2);
        
        resolve({
          text: formattedXml,
          metadata: {
            format: 'XML',
            title: file.name,
            rootElement: Object.keys(result)[0]
          }
        });
      });
    });
  }

  /**
   * Parse PowerPoint files (.pptx, .ppt)
   */
  private async parsePowerPoint(file: File): Promise<ParsedDocument> {
    // PowerPoint parsing is not currently supported in browser environment
    console.log('📊 PowerPoint parsing not available, creating fallback document...');
    return await this.createFallbackDocument(file, 'PowerPoint parsing is not currently supported in browser environment. Please convert to PDF or extract text manually.');
  }



  // Helper methods
  private getFileExtension(filename: string): string {
    return filename.substring(filename.lastIndexOf('.'));
  }

  private async fileToBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async fileToText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }

  private extractTextFromRtfDoc(doc: unknown): string {
    // Simple text extraction from RTF document structure
    if (typeof doc === 'string') {
      return doc;
    }

    if (doc && typeof doc === 'object') {
      const docObj = doc as Record<string, unknown>;

      if (docObj.content) {
        if (Array.isArray(docObj.content)) {
          return docObj.content.map((item: unknown) => this.extractTextFromRtfDoc(item)).join('');
        }
        return this.extractTextFromRtfDoc(docObj.content);
      }

      if (docObj.text && typeof docObj.text === 'string') {
        return docObj.text;
      }
    }

    return '';
  }

  private updateAverageProcessingTime(newTime: number): void {
    const totalSuccessful = this.stats.successfulParses;
    if (totalSuccessful === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime =
        ((this.stats.averageProcessingTime * (totalSuccessful - 1)) + newTime) / totalSuccessful;
    }
  }

  private categorizeError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('network') || message.includes('fetch')) {
        return 'network';
      } else if (message.includes('permission') || message.includes('access')) {
        return 'permission';
      } else if (message.includes('format') || message.includes('invalid')) {
        return 'format';
      } else if (message.includes('memory') || message.includes('size')) {
        return 'memory';
      } else if (message.includes('timeout')) {
        return 'timeout';
      } else {
        return 'parsing';
      }
    }
    return 'unknown';
  }

  private async createFallbackDocument(file: File, originalError: string): Promise<ParsedDocument> {
    const fileExtension = this.getFileExtension(file.name).toLowerCase();
    const fileSize = Math.round(file.size / 1024);

    // Try to extract basic file metadata
    let fallbackText = `[Document: ${file.name}]\n`;
    fallbackText += `File Type: ${file.type || 'Unknown'}\n`;
    fallbackText += `File Size: ${fileSize}KB\n`;
    fallbackText += `Extension: ${fileExtension}\n`;
    fallbackText += `\nParsing Error: ${originalError}\n`;

    // Add format-specific guidance
    if (fileExtension === '.docx' || fileExtension === '.doc') {
      fallbackText += `\nTroubleshooting for Word documents:\n`;
      fallbackText += `• The document may be password-protected\n`;
      fallbackText += `• The file might be corrupted or incomplete\n`;
      fallbackText += `• Try saving as a newer .docx format\n`;
      fallbackText += `• Consider converting to PDF for better compatibility\n`;
      fallbackText += `• You can copy and paste the text content directly into the chat\n`;
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      fallbackText += `\nTroubleshooting for Excel files:\n`;
      fallbackText += `• The spreadsheet may be password-protected\n`;
      fallbackText += `• Try saving as a newer .xlsx format\n`;
      fallbackText += `• Consider exporting as CSV for text analysis\n`;
    } else if (fileExtension === '.pptx' || fileExtension === '.ppt') {
      fallbackText += `\nNote: PowerPoint parsing is limited in browser environments.\n`;
      fallbackText += `• Try converting to PDF for better text extraction\n`;
      fallbackText += `• You can copy slide content and paste it directly\n`;
    }

    fallbackText += `\nWhat you can do:\n`;
    fallbackText += `• Describe the document content and ask specific questions\n`;
    fallbackText += `• Convert the file to PDF, TXT, or another supported format\n`;
    fallbackText += `• Copy and paste the text content directly into the chat\n`;
    fallbackText += `• Share specific sections or data you'd like me to analyze\n`;

    // Try to read as plain text if it might be a text-based format
    if (['.txt', '.md', '.log', '.csv', '.json', '.xml', '.html', '.htm'].includes(fileExtension)) {
      try {
        const textContent = await this.fileToText(file);
        if (textContent && textContent.trim().length > 0) {
          fallbackText += `\n\nRaw Content (may contain formatting artifacts):\n${textContent.substring(0, 2000)}`;
          if (textContent.length > 2000) {
            fallbackText += `\n... (content truncated, showing first 2000 characters)`;
          }
        }
      } catch (textError) {
        console.log(`Could not read ${file.name} as text:`, textError);
      }
    }

    return {
      text: fallbackText,
      metadata: {
        format: 'Fallback',
        title: file.name,
        originalError,
        fallbackUsed: true,
        fileSize: file.size,
        fileType: file.type
      }
    };
  }
}

export const documentParserService = new DocumentParserService();
