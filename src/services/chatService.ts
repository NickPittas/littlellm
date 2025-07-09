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
  lastSelectedModel?: string;
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
 * Estimate token count for a message
 * Rough estimation: 1 token ≈ 4 characters
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export const chatService = {
  // Helper function to check if a model supports vision
  supportsVision(provider: string, model: string): boolean {
    const visionModels = {
      openai: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4-vision-preview'
      ],
      openrouter: [
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'openai/gpt-4-turbo',
        'openai/gpt-4-vision-preview',
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
        'anthropic/claude-3-haiku',
        'google/gemini-pro-1.5',
        'google/gemini-flash-1.5',
        'google/gemini-pro-vision'
      ],
      requesty: [
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'openai/gpt-4-turbo',
        'openai/gpt-4-vision-preview',
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
        'anthropic/claude-3-haiku',
        'google/gemini-pro-1.5',
        'google/gemini-flash-1.5',
        'google/gemini-pro-vision'
      ],
      ollama: [] // Ollama vision support is detected differently
    };

    const supportedModels = visionModels[provider as keyof typeof visionModels] || [];
    const isSupported = supportedModels.includes(model);

    console.log(`Vision support check - Provider: ${provider}, Model: ${model}, Supported: ${isSupported}`);
    return isSupported;
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
        verbosity: 0,
        disableWorker: false,
        isEvalSupported: false
      });

      const pdf = await loadingTask.promise;
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

  // Helper function to convert file to base64 with image optimization
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('Converting file to base64:', file.name, file.type, file.size);

      if (file.type.startsWith('image/')) {
        // Optimize image size for vision models
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
          try {
            console.log('Image loaded, original dimensions:', img.width, 'x', img.height);

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
              console.log('Image resized to:', width, 'x', height);
            }

            canvas.width = width;
            canvas.height = height;

            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);

              // Convert to JPEG with compression to reduce size
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
              console.log('Image converted to base64, length:', dataUrl.length);
              resolve(dataUrl);
            } else {
              throw new Error('Could not get canvas context');
            }
          } catch (error) {
            console.error('Error processing image:', error);
            reject(error);
          }
        };

        img.onerror = (error) => {
          console.error('Failed to load image:', error);
          reject(new Error('Failed to load image'));
        };

        const reader = new FileReader();
        reader.onload = () => {
          console.log('File read as data URL, setting image source');
          img.src = reader.result as string;
        };
        reader.onerror = error => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(file);
      } else {
        // For non-image files, use standard base64 conversion
        console.log('Converting non-image file to base64');
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          console.log('Non-image file converted to base64');
          resolve(reader.result as string);
        };
        reader.onerror = error => {
          console.error('FileReader error for non-image:', error);
          reject(error);
        };
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
              verbosity: 0, // Reduce console noise
              disableWorker: false, // Try with worker first
              isEvalSupported: false // Disable eval for security
            });

            const pdf = await loadingTask.promise;
            console.log('PDF loaded successfully, pages:', pdf.numPages);

            let fullText = '';
            const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages

            // Extract text from each page
            for (let i = 1; i <= maxPages; i++) {
              try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str || '')
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
              resolve(`[PDF Document: ${file.name}]\n\n${fullText.trim()}`);
            } else {
              console.log('No text extracted from PDF');
              resolve(`[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Could not extract text from this PDF. It may contain only images, be password protected, or be a scanned document.`);
            }
          } catch (pdfError) {
            console.error('PDF parsing error:', pdfError);

            // Try fallback without worker if worker-related error
            if (pdfError.message && pdfError.message.includes('worker')) {
              try {
                console.log('Retrying PDF parsing without worker...');
                const pdfjsLib = await import('pdfjs-dist');

                // Disable worker completely
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';

                const fallbackLoadingTask = pdfjsLib.getDocument({
                  data: arrayBuffer,
                  verbosity: 0,
                  disableWorker: true // Force disable worker
                });

                const fallbackPdf = await fallbackLoadingTask.promise;
                console.log('PDF loaded successfully without worker, pages:', fallbackPdf.numPages);

                let fallbackText = '';
                const maxPages = Math.min(fallbackPdf.numPages, 10);

                for (let i = 1; i <= maxPages; i++) {
                  try {
                    const page = await fallbackPdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items
                      .map((item: any) => item.str || '')
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
                  resolve(`[PDF Document: ${file.name}]\n\n${fallbackText.trim()}`);
                  return;
                }
              } catch (fallbackError) {
                console.error('PDF fallback parsing also failed:', fallbackError);
              }
            }

            resolve(`[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: Could not extract text from this PDF due to an error: ${pdfError.message}. Please describe the content you'd like me to analyze.`);
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
    console.log('🚀 ChatService.sendMessage called with:', {
      message: message.substring(0, 100) + '...',
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!settings.providers[settings.provider]?.apiKey,
      filesCount: files?.length || 0
    });

    try {
      // Handle file attachments with proper OpenRouter vision API format
      let messageContent: string | Array<any> = message;

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

          const contentArray: Array<any> = [
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
                pdfImages.forEach((imageDataUrl, index) => {
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
                  pdfImages.forEach((imageDataUrl, index) => {
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
      const providerSettings = settings.providers[settings.provider] || { apiKey: '' };

      // Check if API key is required and missing
      if (settings.provider !== 'ollama' && !providerSettings.apiKey) {
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

      const response = await llmService.sendMessage(
        messageContent,
        llmSettings,
        llmHistory,
        onStream,
        signal
      );

      console.log('✅ LLM response received:', {
        contentLength: response.content?.length || 0,
        hasUsage: !!response.usage
      });

      return {
        id: Date.now().toString(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        usage: response.usage,
      };
    } catch (error) {
      console.error('❌ Chat service error:', error);
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
