import { llmService, type LLMSettings } from './llmService';
import { sessionService } from './sessionService';

// Type definitions for PDF.js
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getTextContent(): Promise<TextContent>;
  render(params: RenderParameters): RenderTask;
  getViewport(params: { scale: number }): PageViewport;
}

interface TextContent {
  items: (TextItem | TextMarkedContent)[];
}

interface TextItem {
  str: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
}

interface TextMarkedContent {
  type: string;
}

interface RenderParameters {
  canvasContext: CanvasRenderingContext2D;
  viewport: PageViewport;
}

interface RenderTask {
  promise: Promise<void>;
}

interface PageViewport {
  width: number;
  height: number;
  scale: number;
}

// Type for PDF.js getDocument parameters
interface PDFDocumentInitParameters {
  data: ArrayBuffer;
  verbosity?: number;
}

// Type for content array items used in vision API
interface ContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

// Type for tool call arguments - can be any valid JSON value
type ToolCallArguments = Record<string, unknown>;

export interface Message {
  id: string;
  content: string | Array<ContentItem>;
  role: 'user' | 'assistant';
  timestamp: Date;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timing?: {
    startTime: number;
    endTime: number;
    duration: number; // in milliseconds
    tokensPerSecond?: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: ToolCallArguments;
  }>;
}

export interface ProviderSettings {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  lastSelectedModel?: string;
}

export interface ChatSettings {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  toolCallingEnabled: boolean;
  providers: {
    [key: string]: ProviderSettings;
  };
}





export const chatService = {
  // Helper function to check if a model supports vision
  supportsVision(provider: string, model: string): boolean {
    // Assume all models support vision by default
    // Let the individual APIs return errors if they don't support vision
    // This is more robust and future-proof than maintaining model lists

    console.log(`Vision support check - Provider: ${provider}, Model: ${model}, Supported: true (assumed)`);
    return true;
  },

  // Helper function to convert PDF pages to images
  async pdfToImages(file: File): Promise<string[]> {
    try {
      console.log('Converting PDF to images:', file.name);

      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');

      // Use local worker to avoid CORS issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0
      } as PDFDocumentInitParameters);

      const pdf: PDFDocumentProxy = await loadingTask.promise;
      console.log('PDF loaded for image conversion, pages:', pdf.numPages);

      const images: string[] = [];
      const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages

      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };

            await page.render(renderContext).promise;

            // Convert canvas to base64 image
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            images.push(imageDataUrl);

            console.log(`Converted PDF page ${i} to image, size: ${imageDataUrl.length}`);
          }
        } catch (pageError) {
          console.error(`Error converting PDF page ${i} to image:`, pageError);
        }
      }

      console.log(`PDF converted to ${images.length} images`);
      return images;
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      return [];
    }
  },

  // Helper function to convert file to base64 (no processing needed)
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('Reading file as base64:', file.name, file.type, file.size);

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        console.log('File converted to base64, length:', result.length);
        resolve(result);
      };
      reader.onerror = error => {
        console.error('FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  },

  // Helper function to extract text from files
  async extractTextFromFile(file: File): Promise<string> {
    if (file.type === 'text/plain') {
      // For text files, return content directly
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
      });
    } else if (file.type === 'application/pdf') {
      // For PDFs, try to extract text using PDF.js (browser-compatible)
      try {
        console.log('Starting PDF text extraction for:', file.name);

        // Use PDF.js for client-side PDF parsing
        const arrayBuffer = await file.arrayBuffer();
        console.log('PDF arrayBuffer size:', arrayBuffer.byteLength);

        // Import PDF.js dynamically for browser compatibility
        const pdfjsLib = await import('pdfjs-dist');

        // Use local worker to avoid CORS issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

        console.log('PDF.js configured with local worker:', pdfjsLib.GlobalWorkerOptions.workerSrc);

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          verbosity: 0 // Reduce console noise
        } as PDFDocumentInitParameters);

        const pdf: PDFDocumentProxy = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdf.numPages);

        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages

        // Extract text from each page
        for (let i = 1; i <= maxPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: TextItem | TextMarkedContent) => ('str' in item ? item.str : '') || '')
              .filter(str => str.trim().length > 0)
              .join(' ');

            if (pageText.trim()) {
              fullText += `Page ${i}:\n${pageText.trim()}\n\n`;
            }
            console.log(`Extracted text from page ${i}, length:`, pageText.length);
          } catch (pageError) {
            console.error(`Error extracting text from page ${i}:`, pageError);
            fullText += `Page ${i}: [Error extracting text from this page]\n\n`;
          }
        }

        if (fullText.trim()) {
          console.log('PDF text extraction successful, total length:', fullText.length);
          return `[PDF Document: ${file.name}]\n\n${fullText.trim()}`;
        } else {
          console.log('No text extracted from PDF');
          return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Could not extract text from this PDF. It may contain only images, be password protected, or be a scanned document.`;
        }
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);

        // Try fallback without worker if worker-related error
        if (pdfError instanceof Error && pdfError.message && pdfError.message.includes('worker')) {
          try {
            console.log('Retrying PDF parsing without worker...');
            const pdfjsLib = await import('pdfjs-dist');

            // Disable worker completely
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';

            const fallbackArrayBuffer = await file.arrayBuffer();
            const fallbackLoadingTask = pdfjsLib.getDocument({
              data: fallbackArrayBuffer,
              verbosity: 0
            } as PDFDocumentInitParameters);

            const fallbackPdf: PDFDocumentProxy = await fallbackLoadingTask.promise;
            console.log('PDF loaded successfully without worker, pages:', fallbackPdf.numPages);

            let fallbackText = '';
            const maxPages = Math.min(fallbackPdf.numPages, 10);

            for (let i = 1; i <= maxPages; i++) {
              try {
                const page = await fallbackPdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: TextItem | TextMarkedContent) => ('str' in item ? item.str : '') || '')
                  .filter(str => str.trim().length > 0)
                  .join(' ');

                if (pageText.trim()) {
                  fallbackText += `Page ${i}:\n${pageText.trim()}\n\n`;
                }
              } catch (pageError) {
                console.error(`Error extracting text from page ${i} (fallback):`, pageError);
              }
            }

            if (fallbackText.trim()) {
              console.log('PDF text extraction successful (fallback), total length:', fallbackText.length);
              return `[PDF Document: ${file.name}]\n\n${fallbackText.trim()}`;
            }
          } catch (fallbackError) {
            console.error('PDF fallback parsing also failed:', fallbackError);
          }
        }

        return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Could not extract text from this PDF due to an error: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}. Please describe the content you'd like me to analyze.`;
      }
    } else if (file.type.includes('word') || file.type.includes('document')) {
      // For Word documents, provide placeholder
      return `[Word Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Word document text extraction not yet implemented. Please describe the content you'd like me to analyze.`;
    } else {
      return `[File: ${file.name} - ${Math.round(file.size / 1024)}KB]\nFile type: ${file.type}\nNote: Text extraction not supported for this file type.`;
    }
  },

  async sendMessage(
    message: string,
    files: File[] | undefined,
    settings: ChatSettings,
    conversationHistory: Message[] = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string // Add conversation ID for tool optimization
  ): Promise<Message> {
    console.log('🚀 ChatService.sendMessage called with:', {
      message: message.substring(0, 100) + '...',
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!settings.providers[settings.provider]?.apiKey,
      filesCount: files?.length || 0
    });

    // Also log to window for debugging
    if (typeof window !== 'undefined') {
      (window as Window & { lastChatServiceCall?: unknown }).lastChatServiceCall = {
        message: message.substring(0, 100) + '...',
        provider: settings.provider,
        model: settings.model,
        hasApiKey: !!settings.providers[settings.provider]?.apiKey,
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Handle file attachments with proper OpenRouter vision API format
      let messageContent: string | Array<ContentItem> | { text: string; images: string[] } = message;

      if (files && files.length > 0) {
        console.log('Processing files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));

        const hasImages = files.some(file => file.type.startsWith('image/'));
        const hasPDFs = files.some(file => file.type === 'application/pdf');
        const hasVisualContent = hasImages || hasPDFs;
        const provider = settings.provider;
        const modelSupportsVision = this.supportsVision(provider, settings.model);

        console.log('Has images:', hasImages, 'Has PDFs:', hasPDFs, 'Has visual content:', hasVisualContent, 'Provider:', provider, 'Model supports vision:', modelSupportsVision);

        if (hasVisualContent && modelSupportsVision && (provider === 'openrouter' || provider === 'openai' || provider === 'requesty')) {
          // Use vision API format for providers that support it
          console.log('Using vision API format for provider:', provider);

          const contentArray: Array<ContentItem> = [
            {
              type: 'text',
              text: message || 'Please analyze the attached content.'
            }
          ];

          // Process each file
          for (const file of files) {
            console.log('Processing file:', file.name, file.type);

            if (file.type.startsWith('image/')) {
              // Convert image to base64 data URL
              console.log('Converting image to base64...');
              const base64 = await this.fileToBase64(file);
              console.log('Image converted, base64 length:', base64.length);

              contentArray.push({
                type: 'image_url',
                image_url: {
                  url: base64
                }
              });
            } else if (file.type === 'application/pdf') {
              // Convert PDF pages to images for vision models
              console.log('Converting PDF to images for vision analysis...');
              const pdfImages = await this.pdfToImages(file);

              if (pdfImages.length > 0) {
                console.log(`PDF converted to ${pdfImages.length} images`);

                // Add each PDF page as an image
                pdfImages.forEach((imageDataUrl) => {
                  contentArray.push({
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl
                    }
                  });
                });

                // Add a note about the PDF
                contentArray[0].text += `\n\n[PDF Document: ${file.name} - ${pdfImages.length} pages converted to images for visual analysis]`;
              } else {
                // Fallback to text extraction if image conversion fails
                console.log('PDF image conversion failed, falling back to text extraction...');
                const textContent = await this.extractTextFromFile(file);
                console.log('Text extracted, length:', textContent.length);
                contentArray[0].text += `\n\n${textContent}`;
              }
            } else {
              // Extract text from other documents
              console.log('Extracting text from document...');
              const textContent = await this.extractTextFromFile(file);
              console.log('Text extracted, length:', textContent.length);
              contentArray[0].text += `\n\n${textContent}`;
            }
          }

          messageContent = contentArray;
          console.log('Final vision message content structure:', {
            type: 'array',
            length: contentArray.length,
            hasText: contentArray[0]?.type === 'text',
            hasImages: contentArray.some(item => item.type === 'image_url')
          });
        } else {
          // For providers without vision support or text-only files
          if (provider === 'ollama' && hasVisualContent) {
            // Ollama vision models use a different format
            console.log('Using Ollama vision format');

            let textContent = message || 'Please analyze the attached content.';
            const images: string[] = [];

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                // Convert image to base64 for Ollama
                console.log('Converting image for Ollama:', file.name);
                const base64 = await this.fileToBase64(file);
                // Extract just the base64 data without the data URL prefix
                const base64Data = base64.split(',')[1];
                images.push(base64Data);
                console.log('Added image to Ollama format, base64 length:', base64Data.length);
              } else if (file.type === 'application/pdf') {
                // Convert PDF pages to images for Ollama vision models
                console.log('Converting PDF to images for Ollama:', file.name);
                const pdfImages = await this.pdfToImages(file);

                if (pdfImages.length > 0) {
                  console.log(`PDF converted to ${pdfImages.length} images for Ollama`);

                  // Add each PDF page as an image (extract base64 data only)
                  pdfImages.forEach((imageDataUrl) => {
                    const base64Data = imageDataUrl.split(',')[1];
                    images.push(base64Data);
                  });

                  textContent += `\n\n[PDF Document: ${file.name} - ${pdfImages.length} pages converted to images for visual analysis]`;
                } else {
                  // Fallback to text extraction if image conversion fails
                  console.log('PDF image conversion failed for Ollama, falling back to text extraction...');
                  const extractedText = await this.extractTextFromFile(file);
                  textContent += `\n\n${extractedText}`;
                  console.log('Added text content, total length:', textContent.length);
                }
              } else {
                // Extract and include text content
                console.log('Extracting text for Ollama:', file.name);
                const extractedText = await this.extractTextFromFile(file);
                textContent += `\n\n${extractedText}`;
                console.log('Added text content, total length:', textContent.length);
              }
            }

            // Ollama expects a simple message format with images array
            messageContent = {
              text: textContent,
              images: images
            };
            console.log('Final Ollama message format:', { textLength: textContent.length, imageCount: images.length });
          } else if (provider === 'n8n' && hasVisualContent) {
            // n8n webhook format with images
            console.log('Using n8n webhook format with images');

            let textContent = message || 'Please analyze the attached content.';
            const images: string[] = [];

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                // Convert image to base64 data URL for n8n
                console.log('Converting image for n8n:', file.name);
                const base64 = await this.fileToBase64(file);
                images.push(base64); // Keep full data URL for n8n
                console.log('Added image to n8n format, base64 length:', base64.length);
              } else if (file.type === 'application/pdf') {
                // Convert PDF pages to images for n8n
                console.log('Converting PDF to images for n8n:', file.name);
                const pdfImages = await this.pdfToImages(file);

                if (pdfImages.length > 0) {
                  console.log(`PDF converted to ${pdfImages.length} images for n8n`);
                  images.push(...pdfImages); // Add all PDF page images
                  textContent += `\n\n[PDF Document: ${file.name} - ${pdfImages.length} pages converted to images for analysis]`;
                } else {
                  // Fallback to text extraction if image conversion fails
                  console.log('PDF image conversion failed for n8n, falling back to text extraction...');
                  const extractedText = await this.extractTextFromFile(file);
                  textContent += `\n\n${extractedText}`;
                  console.log('Added text content, total length:', textContent.length);
                }
              } else {
                // Extract and include text content
                console.log('Extracting text for n8n:', file.name);
                const extractedText = await this.extractTextFromFile(file);
                textContent += `\n\n${extractedText}`;
                console.log('Added text content, total length:', textContent.length);
              }
            }

            // n8n expects a message format with images array (similar to Ollama but with full data URLs)
            messageContent = {
              text: textContent,
              images: images
            };
            console.log('Final n8n message format:', { textLength: textContent.length, imageCount: images.length });
          } else {
            // For other providers or models without vision support
            if (hasVisualContent && !modelSupportsVision) {
              console.log(`Model ${settings.model} does not support vision - falling back to text extraction`);
            } else {
              console.log('Using text-only format for provider:', provider);
            }

            let combinedText = message;

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                if (!modelSupportsVision) {
                  console.log('Model does not support vision, adding image placeholder:', file.name);
                  combinedText += `\n\n[Image attached: ${file.name} - This model (${settings.model}) does not support vision. Please switch to a vision-capable model like gpt-4o, gpt-4o-mini, or gpt-4-turbo to analyze images.]`;
                } else {
                  console.log('Adding image placeholder for non-vision provider:', file.name);
                  combinedText += `\n\n[Image attached: ${file.name} - Vision analysis not supported for this provider]`;
                }
              } else if (file.type === 'application/pdf') {
                if (!modelSupportsVision) {
                  console.log('Model does not support vision, extracting PDF text only:', file.name);
                  const textContent = await this.extractTextFromFile(file);
                  combinedText += `\n\n${textContent}`;
                  combinedText += `\n\n[Note: PDF visual content (images, charts, diagrams) cannot be analyzed with ${settings.model}. Switch to a vision-capable model like gpt-4o to see visual content.]`;
                } else {
                  // Extract text from PDF for non-vision providers
                  console.log('Extracting PDF text for non-vision provider:', file.name);
                  const textContent = await this.extractTextFromFile(file);
                  combinedText += `\n\n${textContent}`;
                }
              } else {
                // Extract and include text content
                console.log('Extracting text content:', file.name);
                const textContent = await this.extractTextFromFile(file);
                combinedText += `\n\n${textContent}`;
                console.log('Added text content, total length:', combinedText.length);
              }
            }

            messageContent = combinedText;
            console.log('Final text-only message length:', combinedText.length);
          }
        }
      }

      // Convert ChatSettings to LLMSettings
      const providerSettings = settings.providers?.[settings.provider] || { apiKey: '' };

      // Debug provider settings
      console.log('🔍 ChatService provider settings debug:', {
        provider: settings.provider,
        hasProviderSettings: !!providerSettings,
        hasApiKey: !!providerSettings.apiKey,
        apiKeyLength: providerSettings.apiKey?.length || 0,
        apiKeyStart: providerSettings.apiKey?.substring(0, 10) || 'undefined'
      });

      // Check if API key is required and missing
      // ollama, lmstudio, and n8n don't require API keys
      if (settings.provider !== 'ollama' && settings.provider !== 'lmstudio' && settings.provider !== 'n8n' && !providerSettings.apiKey) {
        throw new Error(`API key is required for ${settings.provider}. Please configure it in Settings.`);
      }



      const llmSettings: LLMSettings = {
        provider: settings.provider,
        model: settings.model,
        apiKey: providerSettings.apiKey,
        baseUrl: providerSettings.baseUrl,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt,
        toolCallingEnabled: settings.toolCallingEnabled,
      };

      // Convert conversation history to LLM format
      const llmHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Send to LLM service with conversation history
      console.log('🔄 Calling llmService.sendMessage with settings:', {
        provider: llmSettings.provider,
        model: llmSettings.model,
        hasApiKey: !!llmSettings.apiKey,
        baseUrl: llmSettings.baseUrl
      });

      // Track timing for tokens per second calculation
      const startTime = performance.now();

      // Disable streaming for providers that don't support tool calls in streaming mode
      // DeepSeek: disabled to get usage data
      // Gemini: streaming handler doesn't support function calls yet
      const mcpService = (global as typeof globalThis & { mcpService?: { getConnectedServerIds(): Promise<string[]>; getAvailableTools(): Promise<unknown[]> } }).mcpService;
      const hasTools = settings.toolCallingEnabled && mcpService && (await mcpService.getConnectedServerIds()).length > 0 && (await mcpService.getAvailableTools()).length > 0;
      const useStreaming = onStream &&
        settings.provider !== 'deepseek' &&
        !(settings.provider === 'gemini' && hasTools);

      console.log(`🔄 Calling LLM with streaming: ${useStreaming}, hasTools: ${hasTools}, toolCallingEnabled: ${settings.toolCallingEnabled}, provider: ${settings.provider}`);
      if (settings.provider === 'lmstudio' && hasTools) {
        console.log(`✅ LM Studio will use streaming WITH tool support`);
      }

      const response = await llmService.sendMessage(
        messageContent,
        llmSettings,
        llmHistory,
        useStreaming ? onStream : undefined,
        signal,
        conversationId
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Calculate tokens per second if we have usage data
      let tokensPerSecond: number | undefined;
      if (response.usage?.completionTokens && duration > 0) {
        tokensPerSecond = (response.usage.completionTokens / duration) * 1000; // Convert to tokens per second
      }

      console.log('✅ LLM response received:', {
        contentLength: response.content?.length || 0,
        hasUsage: !!response.usage,
        usage: response.usage,
        duration: `${duration.toFixed(2)}ms`,
        tokensPerSecond: tokensPerSecond ? `${tokensPerSecond.toFixed(2)} t/s` : 'N/A'
      });

      // Track token usage in session stats - normalize format
      if (response.usage) {
        // Use the already normalized usage format from llmService
        const normalizedUsage = {
          promptTokens: response.usage.promptTokens || 0,
          completionTokens: response.usage.completionTokens || 0,
          totalTokens: response.usage.totalTokens || (response.usage.promptTokens || 0) + (response.usage.completionTokens || 0)
        };

        console.log('📊 Adding token usage to session:', {
          original: response.usage,
          normalized: normalizedUsage
        });
        await sessionService.addTokenUsage(normalizedUsage);

        // Also log to window for debugging
        if (typeof window !== 'undefined') {
          (window as Window & { lastTokenUsage?: unknown }).lastTokenUsage = {
            usage: response.usage,
            timestamp: new Date().toISOString()
          };
        }
      } else {
        console.warn('⚠️ No usage data in response');

        // Also log to window for debugging
        if (typeof window !== 'undefined') {
          (window as Window & { lastNoUsageResponse?: unknown }).lastNoUsageResponse = {
            hasResponse: !!response,
            responseKeys: response ? Object.keys(response) : [],
            timestamp: new Date().toISOString()
          };
        }
      }

      const assistantMessage = {
        id: Date.now().toString(),
        content: response.content,
        role: 'assistant' as const,
        timestamp: new Date(),
        usage: response.usage,
        timing: {
          startTime,
          endTime,
          duration,
          tokensPerSecond
        },
        toolCalls: response.toolCalls // Include tool calls in the message
      };

      console.log('📋 Created message with toolCalls:', {
        hasToolCalls: !!response.toolCalls,
        toolCallsCount: response.toolCalls?.length || 0,
        toolNames: response.toolCalls?.map(tc => tc.name) || []
      });

      return assistantMessage;
    } catch (error) {
      console.error('❌ Chat service error:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async testConnection(settings: ChatSettings): Promise<boolean> {
    try {
      const providerSettings = settings.providers[settings.provider];
      const llmSettings: LLMSettings = {
        provider: settings.provider,
        model: settings.model,
        apiKey: providerSettings?.apiKey || '',
        baseUrl: providerSettings?.baseUrl,
        temperature: settings.temperature,
        maxTokens: 100, // Use fewer tokens for testing
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
