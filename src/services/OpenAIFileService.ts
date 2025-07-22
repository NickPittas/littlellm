// Removed unused import: APIResponseData

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

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
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

    console.log(`Uploading file to OpenAI: ${file.name} for purpose ${purpose}`);

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI file upload failed:', errorText);
      throw new Error(`OpenAI file upload failed: ${response.statusText} - ${errorText}`);
    }

    const responseData: OpenAIFileUpload = await response.json();
    console.log('OpenAI file upload successful:', responseData);
    return responseData;
  }
}
