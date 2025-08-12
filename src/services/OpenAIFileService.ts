// Removed unused import: APIResponseData

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }

  try {
    const { debugLogger } = require('./debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export interface OpenAIFileUpload {

  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: 'fine-tune' | 'assistants' | 'vision';
  status: 'uploaded' | 'processed' | 'error';
  status_details?: string;
}

export class OpenAIFileService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async uploadFile(file: File, purpose: 'fine-tune' | 'assistants' | 'vision'): Promise<OpenAIFileUpload> {
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('file', file);

    safeDebugLog('info', 'OPENAIFILESERVICE', `Uploading file to OpenAI: ${file.name} for purpose ${purpose}`);

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      safeDebugLog('error', 'OPENAIFILESERVICE', 'OpenAI file upload failed:', errorText);
      throw new Error(`OpenAI file upload failed: ${response.statusText} - ${errorText}`);
    }

    const responseData: OpenAIFileUpload = await response.json();
    safeDebugLog('info', 'OPENAIFILESERVICE', 'OpenAI file upload successful:', responseData);
    return responseData;
  }
}
