import { llmService, type LLMSettings } from './llmService';
import { sessionService } from './sessionService';
import { settingsService } from './settingsService';
import { debugLogger } from './debugLogger';

// Conditionally import services only in browser environment
let secureApiKeyService: {
  getApiKey: (provider: string) => string | null;
  getApiKeyData: (provider: string) => { apiKey: string; baseUrl?: string; lastSelectedModel?: string } | null;
  forceReloadApiKeys: () => Promise<void>;
} | null = null;
let documentParserService: {
  parseDocument: (file: File) => Promise<{ text: string; metadata?: { format?: string; success?: boolean; error?: string; sheets?: string[]; eventCount?: number; title?: string; [key: string]: unknown } }>;
  getStats: () => { totalAttempts: number; successfulParses: number; failedParses: number; fallbacksUsed: number; averageProcessingTime: number; errorsByType: Record<string, number> };
  resetStats: () => void;
} | null = null;

if (typeof window !== 'undefined') {
  import('./secureApiKeyService').then(module => {
    secureApiKeyService = module.secureApiKeyService;
  }).catch(() => {
    console.warn('secureApiKeyService not available');
  });

  import('./DocumentParserService').then(module => {
    documentParserService = module.documentParserService;
  }).catch(error => {
    console.warn('DocumentParserService not available in browser environment:', error);
  });
}

// Type for content array items used in vision API
export interface ContentItem {
  type: 'text' | 'image_url' | 'document';
  text?: string;
  image_url?: {
    url: string;
  };
  document?: {
    name: string;
    media_type: string;
    data: string;
  };
}

// Type for tool call arguments - can be any valid JSON value
type ToolCallArguments = Record<string, unknown>;

export interface Source {
  type: 'knowledge_base' | 'web' | 'document';
  title: string;
  url?: string;
  score?: number;
  snippet?: string;
}

export interface Message {
  id: string;
  content: string | Array<ContentItem>;
  role: 'user' | 'assistant';
  timestamp: Date;
  isThinking?: boolean; // Mark message as a thinking indicator bubble
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
    result?: string;
    error?: boolean;
  }>;
  sources?: Source[];
}

// Import shared types
import type { ProviderSettings, ChatSettings, ProvidersConfig } from '../types/settings';

// Re-export for convenience
export type { ProviderSettings, ChatSettings, ProvidersConfig };

// RAG result types
interface RAGResult {
  text: string;
  source: string;
  score?: number;
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
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    // Check if this is a supported document format for parsing
    const supportedFormats = ['.docx', '.doc', '.xlsx', '.xls', '.ods', '.csv', '.html', '.htm', '.ics', '.json', '.rtf', '.xml', '.pptx', '.ppt'];

    if (file.type === 'text/plain' || fileExtension === '.txt' || fileExtension === '.md' || fileExtension === '.log') {
      // For plain text files, return content directly
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
      });
    } else if (file.type === 'application/pdf') {
      // Parse PDF using Electron main process (same working method as knowledge base)
      try {
        console.log('📄 Parsing PDF file using Electron main process:', file.name);

        // Check if we're in Electron environment with API access
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.parsePdfFile) {
          const fileBuffer = await file.arrayBuffer();
          const result = await window.electronAPI.parsePdfFile(fileBuffer, file.name);

          console.log('📄 PDF parsing result:', { success: result.success, textLength: result.text?.length, error: result.error });

          if (result.success && result.text) {
            console.log(`📄 PDF content preview: "${result.text.substring(0, 200)}"`);

            // Check if this is actually the fallback error message
            if (result.text.includes('PDF parsing module could not be loaded') ||
                result.text.includes('PDF text extraction is not available')) {
              console.error('📄 PDF parsing failed - received fallback message');
              return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\n❌ Parsing Status: Failed\nError: PDF parsing module not available\n\nThe PDF file was uploaded but text extraction failed. You can:\n• Describe the content you'd like me to analyze\n• Copy and paste text from the PDF\n• Convert the PDF to a text file and upload that instead`;
            }

            // Return the actual parsed text content
            return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\n✅ Parsing Status: Success\nPages: ${result.metadata?.pages || 1}\n\nContent:\n${result.text}`;
          } else {
            console.error('📄 PDF parsing failed:', result.error);
            return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\n❌ Parsing Status: Failed\nError: ${result.error || 'Unknown error'}\n\nThe PDF file was uploaded but text extraction failed. You can:\n• Describe the content you'd like me to analyze\n• Copy and paste text from the PDF\n• Convert the PDF to a text file and upload that instead`;
          }
        } else {
          // Fallback if electronAPI is not available
          console.log('📄 ElectronAPI not available, using fallback for PDF:', file.name);
          return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\nNote: PDF parsing not available in this environment.\n\nPlease describe what you'd like me to analyze about this PDF.`;
        }
      } catch (error) {
        console.error('📄 PDF parsing error:', error);
        return `[PDF Document: ${file.name} - ${Math.round(file.size / 1024)}KB]\n❌ Parsing Status: Error\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease describe what you'd like me to analyze about this PDF.`;
      }
    } else if (supportedFormats.includes(fileExtension)) {
      // Use DocumentParserService for supported document formats
      try {
        if (!documentParserService) {
          throw new Error('DocumentParserService not available in this environment');
        }
        console.log(`📄 Using DocumentParserService to parse: ${file.name}`);
        const parsedDocument = await documentParserService.parseDocument(file);

        // Return formatted text with metadata
        let result = `[${parsedDocument.metadata?.format || 'Document'}: ${file.name}]\n`;

        // Add processing status
        if (parsedDocument.metadata?.success === false) {
          result += `⚠️ Parsing Status: Failed (using fallback)\n`;
          if (parsedDocument.metadata?.error) {
            result += `Error: ${parsedDocument.metadata.error}\n`;
          }
        } else {
          result += `✅ Parsing Status: Success\n`;
        }

        if (parsedDocument.metadata?.processingTime) {
          result += `Processing Time: ${parsedDocument.metadata.processingTime}ms\n`;
        }

        if (parsedDocument.metadata?.title && parsedDocument.metadata.title !== file.name) {
          result += `Title: ${parsedDocument.metadata.title}\n`;
        }
        if (parsedDocument.metadata?.sheets) {
          result += `Sheets: ${parsedDocument.metadata.sheets.join(', ')}\n`;
        }
        if (parsedDocument.metadata?.eventCount) {
          result += `Events: ${parsedDocument.metadata.eventCount}\n`;
        }

        result += `\nContent:\n${parsedDocument.text}`;

        return result;
      } catch (error) {
        console.error(`❌ Failed to parse document ${file.name}:`, error);
        return `[${file.name} - ${Math.round(file.size / 1024)}KB]\nError: Failed to parse document - ${error instanceof Error ? error.message : 'Unknown error'}\nPlease describe the content you'd like me to analyze.`;
      }
    } else {
      return `[File: ${file.name} - ${Math.round(file.size / 1024)}KB]\nFile type: ${file.type}\nNote: Text extraction not supported for this file type.`;
    }
  },

  // Get document parsing statistics
  getDocumentParsingStats() {
    if (!documentParserService) {
      return { totalAttempts: 0, successfulParses: 0, failedParses: 0, fallbacksUsed: 0, averageProcessingTime: 0, errorsByType: {} };
    }
    return documentParserService.getStats();
  },

  // Reset document parsing statistics
  resetDocumentParsingStats() {
    if (documentParserService) {
      documentParserService.resetStats();
    }
  },

  async sendMessage(
    message: string,
    files: File[] | undefined,
    settings: ChatSettings,
    conversationHistory: Message[] = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string, // Add conversation ID for tool optimization
    onKnowledgeBaseSearch?: (isSearching: boolean, query?: string) => void
  ): Promise<Message> {
    debugLogger.info('CHAT', 'sendMessage called', {
      message: message.substring(0, 100) + '...',
      provider: settings.provider,
      model: settings.model,
      hasApiKey: !!secureApiKeyService?.getApiKey(settings.provider),
      filesCount: files?.length || 0
    });

    // Also log to window for debugging
    if (typeof window !== 'undefined') {
      (window as Window & { lastChatServiceCall?: unknown }).lastChatServiceCall = {
        message: message.substring(0, 100) + '...',
        provider: settings.provider,
        model: settings.model,
        hasApiKey: !!secureApiKeyService?.getApiKey(settings.provider),
        timestamp: new Date().toISOString()
      };
    }

    try {
      // RAG Integration: Augment message with knowledge base context if enabled
      let augmentedMessage = message;
      let sources: Source[] = [];

      if (settings.ragEnabled && typeof window !== 'undefined' && window.electronAPI) {
        try {
          console.log('🧠 RAG enabled, searching knowledge base for:', message.substring(0, 100));

          // Notify UI that knowledge base search is starting
          onKnowledgeBaseSearch?.(true, message);

          // Detect if this is a comprehensive query that needs all documents
          const isComprehensiveQuery = /\b(all|total|sum|add|combine|every|each)\b/i.test(message);
          const searchLimit = isComprehensiveQuery ? 20 : 5; // Higher limit for comprehensive queries

          const ragResult = await window.electronAPI.searchKnowledgeBase(message, searchLimit);
          
          if (ragResult.success && ragResult.results && ragResult.results.length > 0) {
            console.log(`🧠 Found ${ragResult.results.length} relevant knowledge base chunks (comprehensive: ${isComprehensiveQuery})`);
            
            let selectedChunks;
            
            if (isComprehensiveQuery) {
              // For comprehensive queries, ensure we get chunks from different documents
              const chunksBySource = new Map<string, RAGResult[]>();

              // Group chunks by source document
              ragResult.results.forEach((result: RAGResult) => {
                if (!chunksBySource.has(result.source)) {
                  chunksBySource.set(result.source, []);
                }
                chunksBySource.get(result.source)!.push(result);
              });
              
              // Take the best chunk from each document, up to 8 total chunks
              selectedChunks = [];
              for (const [, chunks] of chunksBySource.entries()) {
                selectedChunks.push(chunks[0]); // Best chunk from this document
                if (selectedChunks.length >= 8) break;
              }
              
              console.log(`🧠 Selected chunks from ${chunksBySource.size} different documents`);
            } else {
              // For specific queries, use top 3 most relevant chunks
              selectedChunks = ragResult.results.slice(0, 3);
            }
            
            // Extract relevant text chunks and format them as context
            const contextChunks = selectedChunks
              .map((result: RAGResult, index: number) =>
                `[Context ${index + 1} from ${result.source}]:\n${result.text}`
              )
              .join('\n\n');
            
            // Augment the original message with context
            const contextIntro = isComprehensiveQuery 
              ? `Based on the following context from ALL documents in your knowledge base`
              : `Based on the following context from your knowledge base`;
            
            augmentedMessage = `${contextIntro}:\n\n${contextChunks}\n\n---\n\nUser Question: ${message}`;
            
            // Collect sources from RAG results
            sources = selectedChunks.map((result: RAGResult) => ({
              type: 'knowledge_base' as const,
              title: result.source,
              score: result.score,
              snippet: result.text.substring(0, 150) + (result.text.length > 150 ? '...' : '')
            }));

            console.log('🧠 Message augmented with RAG context:', {
              originalLength: message.length,
              augmentedLength: augmentedMessage.length,
              contextChunks: ragResult.results.length,
              sources: sources.length
            });
          } else {
            console.log('🧠 No relevant context found in knowledge base');
          }

          // Notify UI that knowledge base search is complete
          onKnowledgeBaseSearch?.(false);
        } catch (ragError) {
          console.error('🧠 RAG search failed:', ragError);
          // Notify UI that knowledge base search is complete (even on error)
          onKnowledgeBaseSearch?.(false);
          // Continue with original message if RAG fails
        }
      }
      
      // Handle file attachments with proper OpenRouter vision API format
      let messageContent: string | Array<ContentItem> | { text: string; images: string[] } = augmentedMessage;

      if (files && files.length > 0) {
        console.log('Processing files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));

        const provider = settings.provider;
        console.log('Processing files for provider:', provider, 'Files:', files.map(f => ({ name: f.name, type: f.type })));

        // Send files directly to providers in their expected format
        console.log('Sending files directly to provider:', provider);

        if (provider === 'mistral') {
          // Use Mistral's native file processing capabilities
          console.log('🔍 Using Mistral native file processing');
          const mistralProvider = this.getProviderInstance('mistral');
          console.log('🔍 Mistral provider instance:', mistralProvider);
          console.log('🔍 Has processFiles method:', mistralProvider && 'processFiles' in mistralProvider);

          if (mistralProvider && 'processFiles' in mistralProvider) {
            try {
              console.log('🔍 Calling Mistral processFiles with:', {
                filesCount: files.length,
                fileNames: Array.from(files).map(f => f.name),
                provider: this.getProviderConfig(provider)
              });

              const processedFiles = await (mistralProvider as {processFiles: (files: File[], settings: ChatSettings, config: unknown) => Promise<unknown[]>}).processFiles(
                Array.from(files),
                settings,
                this.getProviderConfig(provider)
              );

              const contentArray: Array<ContentItem> = [
                {
                  type: 'text',
                  text: message || 'Please analyze the attached content.'
                },
                ...(processedFiles as ContentItem[])
              ];

              messageContent = contentArray;
              console.log('✅ Mistral files processed successfully:', {
                processedCount: processedFiles.length,
                contentTypes: processedFiles.map((f: unknown) => (f as {type: string}).type)
              });
            } catch (error) {
              console.error('❌ Mistral file processing failed:', error);
              // Fallback to generic processing
              console.log('🔄 Falling back to generic processing');
              messageContent = await this.processFilesGeneric(files, augmentedMessage, provider);
            }
          } else {
            // Fallback to generic processing
            console.log('🔄 No Mistral provider or processFiles method, using generic processing');
            messageContent = await this.processFilesGeneric(files, augmentedMessage, provider);
          }
        } else if (provider === 'openai' || provider === 'anthropic' || provider === 'gemini' || provider === 'deepseek' || provider === 'openrouter' || provider === 'replicate' || provider === 'requesty' || provider === 'n8n') {
          messageContent = await this.processFilesGeneric(files, augmentedMessage, provider);
        } else if (provider === 'ollama') {
          // Ollama uses a different format with separate images array
          console.log('Using Ollama format');

          let textContent = augmentedMessage || 'Please analyze the attached content.';
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
            } else {
              // For all other files (PDF, TXT, CSV, etc.), extract text content
              console.log('Extracting text for Ollama:', file.name);
              const extractedText = await this.extractTextFromFile(file);
              textContent += `\n\n[File: ${file.name}]\n${extractedText}`;
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
          // For all other providers, use simple text format
          console.log('Using simple text format for provider:', provider);

          let combinedText = augmentedMessage || 'Please analyze the attached content.';

          for (const file of files) {
            if (file.type.startsWith('image/')) {
              console.log('Adding image placeholder for text-only provider:', file.name);
              combinedText += `\n\n[Image attached: ${file.name} - Please describe what you'd like me to analyze about this image.]`;
            } else {
              // Extract text from all other files
              console.log('Extracting text from file:', file.name);
              const textContent = await this.extractTextFromFile(file);
              combinedText += `\n\n[File: ${file.name}]\n${textContent}`;
            }
          }

          messageContent = combinedText;
          console.log('Final text message content length:', combinedText.length);
        }
      }

      // Get provider settings and API key from secure storage
      const providerSettings = settings.providers?.[settings.provider] || {};
      const apiKeyData = secureApiKeyService?.getApiKeyData(settings.provider);
      const apiKey = apiKeyData?.apiKey || '';

      // Merge baseUrl from both sources (secure storage takes precedence)
      const baseUrl = apiKeyData?.baseUrl || providerSettings.baseUrl || '';

      // Debug provider settings
      console.log('🔍 ChatService provider settings debug:', {
        provider: settings.provider,
        hasProviderSettings: !!providerSettings,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyStart: apiKey?.substring(0, 10) || 'undefined',
        fromSecureStorage: !!apiKeyData,
        baseUrlFromSecure: apiKeyData?.baseUrl || 'none',
        baseUrlFromSettings: providerSettings.baseUrl || 'none',
        finalBaseUrl: baseUrl
      });

      // Check if API key is required and missing
      // ollama, lmstudio, and n8n don't require API keys
      if (settings.provider !== 'ollama' && settings.provider !== 'lmstudio' && settings.provider !== 'n8n' && !apiKey) {
        throw new Error(`API key is required for ${settings.provider}. Please configure it in Settings.`);
      }

      const llmSettings: LLMSettings = {
        provider: settings.provider,
        model: settings.model,
        apiKey: apiKey,
        baseUrl: baseUrl,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt,
        toolCallingEnabled: settings.toolCallingEnabled,
      };

      console.log('🔍 ChatService: Final LLMSettings for', settings.provider, ':', {
        model: settings.model,
        hasApiKey: !!apiKey,
        baseUrl: baseUrl,
        toolCallingEnabled: settings.toolCallingEnabled
      });

      // Get conversation history length setting
      const appSettings = settingsService.getSettings();
      const historyLength = appSettings.general.conversationHistoryLength || 10;

      // Limit conversation history to the specified number of messages
      const limitedHistory = conversationHistory.slice(-historyLength);
      console.log(`🧠 Conversation history limited to ${historyLength} messages (${conversationHistory.length} → ${limitedHistory.length})`);

      // Convert conversation history to LLM format
      const llmHistory = limitedHistory.map(msg => ({
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

      // Extract sources from tool execution content if any web search tools were used
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('🔧 Extracting sources from tool calls:', response.toolCalls.map(tc => tc.name));
        const webSearchSources = this.extractSourcesFromResponseContent(response.content, response.toolCalls);
        console.log('📚 Extracted web search sources:', webSearchSources);
        sources = [...sources, ...webSearchSources];
      }

      console.log('📊 Final sources collected:', sources);

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
        toolCalls: response.toolCalls, // Include tool calls in the message
        sources: sources // Always include sources array, even if empty
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

  /**
   * Extract sources from response content that contains tool execution results
   */
  extractSourcesFromResponseContent(content: string, toolCalls: Array<{id: string, name: string, arguments: ToolCallArguments}>): Source[] {
    const sources: Source[] = [];

    // Look for web search tools in the tool calls
    const webSearchTools = toolCalls.filter(tc => this.isWebSearchTool(tc.name));

    if (webSearchTools.length === 0) {
      return sources;
    }

    // Extract sources from formatted tool results in the content
    for (const toolCall of webSearchTools) {
      try {
        // Look for tool execution blocks or formatted results
        const toolSources = this.extractSourcesFromToolContent(content, toolCall);
        sources.push(...toolSources);
      } catch (error) {
        console.warn(`Failed to extract sources from tool content ${toolCall.name}:`, error);
      }
    }

    return sources;
  },

  /**
   * Extract sources from tool execution content for a specific tool
   */
  extractSourcesFromToolContent(content: string, toolCall: {name: string, arguments: ToolCallArguments}): Source[] {
    const sources: Source[] = [];
    const query = toolCall.arguments.query as string || 'web search';

    // Pattern 1: Look for structured search results with URLs
    const urlPattern = /(?:https?:\/\/[^\s)]+)/g;
    const urls = content.match(urlPattern) || [];

    // Pattern 2: Look for numbered search results
    const numberedResultPattern = /(\d+)\.\s*\*\*([^*]+)\*\*[^\n]*\n[^\n]*🔗\s*(https?:\/\/[^\s\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = numberedResultPattern.exec(content)) !== null) {
      sources.push({
        type: 'web',
        title: match[2].trim(),
        url: match[3],
        snippet: `Search result for: ${query}`
      });
    }

    // Pattern 3: Look for title and URL pairs
    const titleUrlPattern = /\*\*([^*]+)\*\*[^\n]*\n[^\n]*(?:🔗|URL:)\s*(https?:\/\/[^\s\n]+)/g;
    while ((match = titleUrlPattern.exec(content)) !== null) {
      if (!sources.find(s => s.url === match![2])) { // Avoid duplicates
        sources.push({
          type: 'web',
          title: match![1].trim(),
          url: match![2],
          snippet: `Search result for: ${query}`
        });
      }
    }

    // Pattern 4: If no structured results found, create generic sources from URLs
    if (sources.length === 0 && urls.length > 0) {
      urls.slice(0, 5).forEach((url, index) => {
        sources.push({
          type: 'web',
          title: `Web result ${index + 1}`,
          url: url,
          snippet: `Search result for: ${query}`
        });
      });
    }

    // Pattern 5: If still no sources, create a generic web search source
    if (sources.length === 0) {
      sources.push({
        type: 'web',
        title: `Web search: ${query}`,
        snippet: 'Web search was performed but specific sources could not be extracted'
      });
    }

    return sources;
  },

  /**
   * Check if a tool name is a web search tool
   */
  isWebSearchTool(toolName: string): boolean {
    const webSearchTools = [
      'web_search', 'web-search', 'search', 'google_search',
      'tavily-search', 'brave_web_search', 'brave_local_search',
      'web-fetch', 'fetch', 'fetch_content'
    ];
    return webSearchTools.includes(toolName);
  },

  /**
   * Parse web search results to extract sources
   */
  parseWebSearchSources(result: unknown, args: ToolCallArguments): Source[] {
    const sources: Source[] = [];

    try {
      // Handle different result formats
      if (typeof result === 'string') {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(result);
          return this.parseWebSearchSources(parsed, args);
        } catch {
          // If not JSON, create a generic source
          const query = args.query as string || 'web search';
          sources.push({
            type: 'web',
            title: `Web search: ${query}`,
            snippet: result.substring(0, 150) + (result.length > 150 ? '...' : '')
          });
        }
      } else if (typeof result === 'object' && result !== null) {
        const resultObj = result as Record<string, unknown>;

        // Handle Tavily search results
        if (resultObj.results && Array.isArray(resultObj.results)) {
          for (const item of resultObj.results) {
            if (typeof item === 'object' && item !== null) {
              const itemObj = item as Record<string, unknown>;
              sources.push({
                type: 'web',
                title: itemObj.title as string || 'Web result',
                url: itemObj.url as string,
                snippet: itemObj.content as string || itemObj.snippet as string
              });
            }
          }
        }

        // Handle Brave search results
        if (resultObj.web && typeof resultObj.web === 'object') {
          const webObj = resultObj.web as Record<string, unknown>;
          if (webObj.results && Array.isArray(webObj.results)) {
            for (const item of webObj.results) {
              if (typeof item === 'object' && item !== null) {
                const itemObj = item as Record<string, unknown>;
                sources.push({
                  type: 'web',
                  title: itemObj.title as string || 'Web result',
                  url: itemObj.url as string,
                  snippet: itemObj.description as string || itemObj.snippet as string
                });
              }
            }
          }
        }

        // Handle generic web search results
        if (resultObj.url || resultObj.title) {
          sources.push({
            type: 'web',
            title: resultObj.title as string || 'Web result',
            url: resultObj.url as string,
            snippet: resultObj.content as string || resultObj.description as string || resultObj.snippet as string
          });
        }
      }
    } catch (error) {
      console.warn('Failed to parse web search sources:', error);
    }

    return sources;
  },

  async testConnection(settings: ChatSettings): Promise<boolean> {
    try {
      const providerSettings = settings.providers[settings.provider];
      const apiKeyData = secureApiKeyService?.getApiKeyData(settings.provider);
      const apiKey = apiKeyData?.apiKey || '';

      const llmSettings: LLMSettings = {
        provider: settings.provider,
        model: settings.model,
        apiKey: apiKey,
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
  },

  clearModelCache(providerId?: string): void {
    return llmService.clearModelCache(providerId);
  },

  // Force refresh API keys and clear any cached data
  async forceRefreshApiKeys(): Promise<void> {
    console.log('🔄 ChatService: Force refreshing API keys...');
    try {
      // Force reload API keys from secure storage
      if (secureApiKeyService) {
        await secureApiKeyService.forceReloadApiKeys();
      }

      // Clear model cache to force fresh fetch with new API keys
      this.clearModelCache();

      console.log('✅ ChatService: API keys and cache refreshed successfully');
    } catch (error) {
      console.error('❌ ChatService: Failed to refresh API keys:', error);
    }
  },

  // Helper method to get provider instance
  getProviderInstance(providerId: string) {
    // Get the actual provider instance from ProviderFactory via llmService's adapter
    return llmService.getProviderAdapter().getProvider(providerId);
  },

  // Helper method to get provider config
  getProviderConfig(providerId: string) {
    const providers = llmService.getProviders();
    return providers.find(p => p.id === providerId);
  },

  // Generic file processing for non-Mistral providers
  async processFilesGeneric(files: File[], message: string, provider: string): Promise<Array<ContentItem>> {
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
      } else {
        const nativelySupported = file.type === 'application/pdf' || file.type.startsWith('text/') || file.type === 'text/csv';

        // Check if provider supports this file type natively
        if (nativelySupported && provider === 'anthropic') {
          // Anthropic supports native document handling for PDFs and text files
          console.log('Sending document to Anthropic:', file.name);
          const base64 = await this.fileToBase64(file);
          const base64Data = base64.split(',')[1]; // Remove data URL prefix

          contentArray.push({
            type: 'document',
            document: {
              name: file.name,
              media_type: file.type,
              data: base64Data
            }
          } as ContentItem);
        } else {
          // For all other cases, extract text content using DocumentParserService
          console.log('Extracting text content for provider:', provider, file.name);
          const textContent = await this.extractTextFromFile(file);
          console.log('Text extracted, length:', textContent.length);
          contentArray[0].text += `\n\n[File: ${file.name}]\n${textContent}`;
        }
      }
    }

    return contentArray;
  }
};
