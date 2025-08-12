// Mistral File Upload and Document AI Service
// Handles file uploads, OCR, and document processing for Mistral AI

export interface MistralFileUploadResponse {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  sample_type?: string;
  num_lines?: number;
  source: string;
}

export interface MistralFileListResponse {
  data: MistralFileUploadResponse[];
  object: string;
}

export interface MistralOCRResponse {
  content: string;
  metadata?: {
    pages?: number;
    language?: string;
    confidence?: number;
  };
}

export type MistralFilePurpose = 'fine-tune' | 'batch' | 'ocr';

export class MistralFileService {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = 'https://api.mistral.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Upload a file to Mistral's file storage
   * Maximum file size: 512 MB (50 MB for OCR)
   * Supported purposes: fine-tune (.jsonl only), batch, ocr
   */
  async uploadFile(
    file: File,
    purpose: MistralFilePurpose = 'batch'
  ): Promise<MistralFileUploadResponse> {
    // Validate file size based on purpose
    let maxSize = 512 * 1024 * 1024; // 512 MB for general uploads
    if (purpose === 'ocr') {
      maxSize = 50 * 1024 * 1024; // 50 MB for OCR
    }

    if (file.size > maxSize) {
      const limitMB = Math.round(maxSize / 1024 / 1024);
      throw new Error(`File size ${Math.round(file.size / 1024 / 1024)}MB exceeds Mistral's ${limitMB}MB limit for ${purpose}`);
    }

    // Validate file type for fine-tuning
    if (purpose === 'fine-tune' && !file.name.endsWith('.jsonl')) {
      throw new Error('Fine-tuning only supports .jsonl files');
    }

    console.log(`📤 Uploading file to Mistral: ${file.name} (${Math.round(file.size / 1024)}KB) for ${purpose}`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    try {
      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Mistral file upload failed (${response.status}):`, errorText);
        
        let errorMessage = errorText;
        try {
          const errorObj = JSON.parse(errorText);
          errorMessage = errorObj.message || errorObj.error?.message || errorText;
        } catch {
          // Keep original error if not JSON
        }

        throw new Error(`Mistral file upload failed: ${errorMessage}`);
      }

      const result = await response.json() as MistralFileUploadResponse;
      console.log(`✅ File uploaded to Mistral successfully:`, result);
      return result;

    } catch (error) {
      console.error('❌ Mistral file upload error:', error);
      throw error;
    }
  }

  /**
   * List all uploaded files
   */
  async listFiles(
    page = 0,
    pageSize = 100,
    purpose?: MistralFilePurpose
  ): Promise<MistralFileListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString()
    });

    if (purpose) {
      params.append('purpose', purpose);
    }

    try {
      const response = await fetch(`${this.baseUrl}/files?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list files: ${errorText}`);
      }

      return await response.json() as MistralFileListResponse;
    } catch (error) {
      console.error('❌ Mistral list files error:', error);
      throw error;
    }
  }

  /**
   * Retrieve file information
   */
  async getFile(fileId: string): Promise<MistralFileUploadResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get file: ${errorText}`);
      }

      return await response.json() as MistralFileUploadResponse;
    } catch (error) {
      console.error('❌ Mistral get file error:', error);
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete file: ${errorText}`);
      }

      console.log(`✅ File ${fileId} deleted successfully`);
    } catch (error) {
      console.error('❌ Mistral delete file error:', error);
      throw error;
    }
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to download file: ${errorText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('❌ Mistral download file error:', error);
      throw error;
    }
  }

  /**
   * Process document with OCR using Mistral's Document AI
   * This uses the /v1/ocr endpoint for PDFs and documents
   */
  async processDocumentOCR(file: File): Promise<MistralOCRResponse> {
    console.log(`🔍 Processing document with Mistral OCR: ${file.name} (${file.type}, ${Math.round(file.size/1024)}KB)`);

    // Validate file size for OCR (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSize) {
      throw new Error(`File size ${Math.round(file.size / 1024 / 1024)}MB exceeds Mistral's 50MB OCR limit`);
    }

    try {
      // Convert file to base64 for OCR endpoint
      const base64 = await this.fileToBase64(file);

      // Determine document type and format
      let documentType: 'image_url' | 'document_url';
      let documentUrl: string;

      if (file.type.startsWith('image/')) {
        documentType = 'image_url';
        documentUrl = base64; // Keep full data URL for images
      } else if (file.type === 'application/pdf' || file.type.includes('document') || file.type.includes('word') || file.type.includes('excel')) {
        documentType = 'document_url';
        documentUrl = base64; // Keep full data URL for documents
      } else {
        throw new Error(`File type ${file.type} not supported for OCR`);
      }

      console.log(`📡 Calling Mistral OCR endpoint: ${this.baseUrl}/ocr`);

      const response = await fetch(`${this.baseUrl}/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          document: {
            type: documentType,
            [documentType === 'image_url' ? 'image_url' : 'document_url']: documentUrl
          },
          include_image_base64: false
        })
      });

      console.log(`📡 OCR response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Mistral OCR failed (${response.status}):`, errorText);
        throw new Error(`Mistral OCR failed (${response.status}): ${errorText}`);
      }

      const result = await response.json() as MistralOCRResponse;
      console.log(`✅ Document processed with Mistral OCR successfully:`, {
        contentLength: result.content?.length || 0,
        hasMetadata: !!result.metadata
      });
      return result;

    } catch (error) {
      console.error('❌ Mistral OCR error:', error);
      throw error;
    }
  }

  /**
   * Convert file to base64 for vision models
   * This is used when sending files directly to vision-capable models
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Prepare file for Mistral models (vision or OCR)
   * Returns the appropriate format for including in chat completions
   */
  async prepareFileForVision(file: File): Promise<{ type: string; image_url?: { url: string }; text?: string }> {
    console.log(`🔍 Preparing file for Mistral: ${file.name} (${file.type})`);

    if (file.type.startsWith('image/')) {
      // For images, use vision models with proper image format
      console.log(`🖼️ Processing image for vision: ${file.name}`);
      const base64 = await this.fileToBase64(file);

      // Ensure proper image format for vision models
      if (!base64.startsWith('data:image/')) {
        throw new Error(`Invalid image format. Expected data:image/*, got: ${base64.substring(0, 20)}...`);
      }

      return {
        type: 'image_url',
        image_url: { url: base64 }
      };
    } else if (file.type === 'application/pdf' ||
               file.type.includes('document') ||
               file.type.includes('word') ||
               file.type.includes('excel') ||
               file.type.includes('powerpoint')) {
      // For PDFs and documents, use OCR to extract text
      console.log(`📄 Processing document with OCR: ${file.name}`);
      try {
        const ocrResult = await this.processDocumentOCR(file);
        return {
          type: 'text',
          text: `[Document: ${file.name}]\n${ocrResult.content}`
        };
      } catch (ocrError) {
        console.warn(`⚠️ OCR failed for ${file.name}, providing file info:`, ocrError);
        return {
          type: 'text',
          text: `[Document: ${file.name}]\nFile type: ${file.type}\nSize: ${Math.round(file.size / 1024)}KB\nNote: OCR processing failed: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`
        };
      }
    } else if (file.type.startsWith('text/') || file.type === 'text/csv' || file.type === 'application/json') {
      // For text files, read content directly
      console.log(`📝 Reading text file: ${file.name}`);
      const text = await this.readTextFile(file);
      return {
        type: 'text',
        text: `[Text File: ${file.name}]\n${text}`
      };
    } else {
      // For other file types, provide a descriptive message
      console.log(`❓ Unsupported file type: ${file.name} (${file.type})`);
      return {
        type: 'text',
        text: `[File: ${file.name}]\nFile type: ${file.type}\nSize: ${Math.round(file.size / 1024)}KB\nNote: This file type cannot be processed for content extraction, but has been included in the conversation.`
      };
    }
  }

  /**
   * Read text file content (fallback method)
   */
  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }

  /**
   * Validate if file is supported by Mistral
   */
  static isFileSupported(file: File): { supported: boolean; reason?: string } {
    // Check file size based on type
    let maxSize = 512 * 1024 * 1024; // 512 MB for general files
    let sizeLimit = '512MB';

    // OCR files have 50MB limit
    if (file.type === 'application/pdf' ||
        file.type.includes('document') ||
        file.type.includes('word') ||
        file.type.includes('excel') ||
        file.type.includes('powerpoint')) {
      maxSize = 50 * 1024 * 1024; // 50 MB for OCR
      sizeLimit = '50MB';
    }

    if (file.size > maxSize) {
      return {
        supported: false,
        reason: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds ${sizeLimit} limit`
      };
    }

    const supportedTypes = [
      // Images (Vision models)
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      // Documents (OCR)
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.ms-excel', // .xls
      // Text files
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/json'
    ];

    // Check if file type is supported
    const isSupported = supportedTypes.includes(file.type) ||
                       file.type.startsWith('text/') ||
                       file.type.includes('document') ||
                       file.type.includes('word') ||
                       file.type.includes('excel') ||
                       file.type.includes('powerpoint');

    if (!isSupported) {
      return {
        supported: false,
        reason: `File type ${file.type} not supported. Supported: images, PDFs, Office documents, text files`
      };
    }

    return { supported: true };
  }
}
