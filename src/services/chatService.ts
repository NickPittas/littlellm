import { llmService, type LLMSettings } from './llmService';

export interface Message {
  id: string;
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
  role: 'user' | 'assistant';
  timestamp: Date;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProviderSettings {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
}

export interface ChatSettings {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  providers: {
    [key: string]: ProviderSettings;
  };
}

/**
 * Limit conversation history to prevent token overflow
 * Keeps recent messages and estimates token usage
 */
function limitConversationHistory(
  history: Array<{role: string, content: string}>,
  maxTokens: number
): Array<{role: string, content: string}> {
  // Rough estimation: 1 token ≈ 4 characters
  // Reserve 50% of tokens for conversation history, 50% for response
  const maxHistoryTokens = Math.floor(maxTokens * 0.5);
  const maxHistoryChars = maxHistoryTokens * 4;

  let totalChars = 0;
  const limitedHistory = [];

  // Start from the most recent messages and work backwards
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    const messageChars = message.content.length;

    if (totalChars + messageChars > maxHistoryChars) {
      break;
    }

    limitedHistory.unshift(message);
    totalChars += messageChars;
  }

  console.log(`Conversation history: ${limitedHistory.length}/${history.length} messages, ~${Math.floor(totalChars/4)} tokens`);
  return limitedHistory;
}

/**
 * Estimate token count for a message
 * Rough estimation: 1 token ≈ 4 characters
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export const chatService = {
  // Helper function to convert file to base64 with image optimization
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        // Optimize image size for vision models
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          // Limit image dimensions to reduce token usage
          const maxDimension = 1024; // Max width or height
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with compression to reduce size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
          resolve(dataUrl);
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        const reader = new FileReader();
        reader.onload = () => {
          img.src = reader.result as string;
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      } else {
        // For non-image files, use standard base64 conversion
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      }
    });
  },

  // Helper function to extract text from files
  async extractTextFromFile(file: File): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        if (file.type === 'text/plain') {
          // For text files, return content directly
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
          reader.readAsText(file);
        } else if (file.type === 'application/pdf') {
          // For PDFs, try to extract text using PDF.js (browser-compatible)
          try {
            // Use PDF.js for client-side PDF parsing
            const arrayBuffer = await file.arrayBuffer();

            // Import PDF.js dynamically for browser compatibility
            const pdfjsLib = await import('pdfjs-dist');

            // Set worker source for PDF.js
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            // Extract text from each page
            for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { // Limit to first 10 pages
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              fullText += `Page ${i}:\n${pageText}\n\n`;
            }

            if (fullText.trim()) {
              resolve(`[PDF Document: ${file.name}]\n\n${fullText.trim()}`);
            } else {
              resolve(`[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Could not extract text from this PDF. It may contain images or be password protected.`);
            }
          } catch (pdfError) {
            console.error('PDF parsing error:', pdfError);
            resolve(`[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Could not extract text from this PDF. Please describe the content you'd like me to analyze.`);
          }
        } else if (file.type.includes('word') || file.type.includes('document')) {
          // For Word documents, provide placeholder
          resolve(`[Word Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Word document text extraction not yet implemented. Please describe the content you'd like me to analyze.`);
        } else {
          resolve(`[File: ${file.name} - ${Math.round(file.size / 1024)}KB]\nFile type: ${file.type}\nNote: Text extraction not supported for this file type.`);
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  async sendMessage(
    message: string,
    files: File[] | undefined,
    settings: ChatSettings,
    conversationHistory: Message[] = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<Message> {
    try {
      // Handle file attachments with proper OpenRouter vision API format
      let messageContent: string | Array<any> = message;

      if (files && files.length > 0) {
        const hasImages = files.some(file => file.type.startsWith('image/'));
        const provider = settings.provider;

        if (hasImages && (provider === 'openrouter' || provider === 'openai' || provider === 'requesty')) {
          // Use vision API format for providers that support it
          const contentArray: Array<any> = [
            {
              type: 'text',
              text: message || 'Please analyze the attached content.'
            }
          ];

          // Process each file
          for (const file of files) {
            if (file.type.startsWith('image/')) {
              // Convert image to base64 data URL
              const base64 = await this.fileToBase64(file);
              contentArray.push({
                type: 'image_url',
                image_url: {
                  url: base64
                }
              });
            } else {
              // Extract text from documents
              const textContent = await this.extractTextFromFile(file);
              contentArray[0].text += `\n\n${textContent}`;
            }
          }

          messageContent = contentArray;
        } else {
          // For providers without vision support or text-only files
          if (provider === 'ollama' && hasImages) {
            // Ollama vision models use a different format
            let textContent = message || 'Please analyze the attached content.';
            const images: string[] = [];

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                // Convert image to base64 for Ollama
                const base64 = await this.fileToBase64(file);
                // Extract just the base64 data without the data URL prefix
                const base64Data = base64.split(',')[1];
                images.push(base64Data);
              } else {
                // Extract and include text content
                const extractedText = await this.extractTextFromFile(file);
                textContent += `\n\n${extractedText}`;
              }
            }

            // Ollama expects a simple message format with images array
            messageContent = {
              text: textContent,
              images: images
            };
          } else {
            // For other providers or text-only
            let combinedText = message;

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                combinedText += `\n\n[Image attached: ${file.name} - Vision analysis not supported for this provider]`;
              } else {
                // Extract and include text content
                const textContent = await this.extractTextFromFile(file);
                combinedText += `\n\n${textContent}`;
              }
            }

            messageContent = combinedText;
          }
        }
      }

      // Convert ChatSettings to LLMSettings
      const providerSettings = settings.providers[settings.provider] || { apiKey: '' };
      const llmSettings: LLMSettings = {
        provider: settings.provider,
        model: settings.model,
        apiKey: providerSettings.apiKey,
        baseUrl: providerSettings.baseUrl,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt,
      };

      // Convert conversation history to LLM format and limit length
      const llmHistory = limitConversationHistory(
        conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        settings.maxTokens || 4000
      );

      // Send to LLM service with conversation history
      const response = await llmService.sendMessage(
        messageContent,
        llmSettings,
        llmHistory,
        onStream,
        signal
      );

      return {
        id: Date.now().toString(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        usage: response.usage,
      };
    } catch (error) {
      console.error('Chat service error:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async testConnection(settings: ChatSettings): Promise<boolean> {
    try {
      const llmSettings: LLMSettings = {
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        temperature: settings.temperature,
        maxTokens: Math.min(settings.maxTokens, 100), // Use fewer tokens for testing
        systemPrompt: settings.systemPrompt,
      };

      return await llmService.testConnection(llmSettings);
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  },

  getProviders() {
    return llmService.getProviders();
  },

  getProvider(id: string) {
    return llmService.getProvider(id);
  },

  async fetchModels(providerId: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    return await llmService.fetchModels(providerId, apiKey, baseUrl);
  }
};
