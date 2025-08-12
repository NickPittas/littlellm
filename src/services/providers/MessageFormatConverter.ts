/**
 * Message Format Converter - Handles conversion between different provider message formats
 * This reduces duplication by centralizing message format logic across providers
 */

import { MessageContent, ContentItem } from './types';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export interface ConversationMessage {
  role: string;
  content: string | Array<ContentItem>;
}

export interface OpenAIMessage {
  role: string;
  content: string | Array<{
    type: string;
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface AnthropicMessage {
  role: string;
  content: string | Array<{
    type: string;
    text?: string;
    image?: { type: string; media_type: string; data: string };
  }>;
}

export interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }>;
}

export class MessageFormatConverter {
  /**
   * Convert internal message format to OpenAI format
   */
  static toOpenAI(messages: ConversationMessage[]): OpenAIMessage[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content
        };
      }

      // Handle complex content with images/documents
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      
      for (const item of msg.content) {
        if (item.type === 'text') {
          content.push({
            type: 'text',
            text: item.text
          });
        } else if (item.type === 'image') {
          content.push({
            type: 'image_url',
            image_url: { url: item.image.url }
          });
        } else if (item.type === 'document') {
          // Convert document to text for OpenAI
          content.push({
            type: 'text',
            text: `[Document: ${item.document.name}]\n${item.document.content || 'Document content not available'}`
          });
        }
      }

      return {
        role: msg.role,
        content: content.length === 1 && content[0].type === 'text' ? content[0].text! : content
      };
    });
  }

  /**
   * Convert internal message format to Anthropic format
   */
  static toAnthropic(messages: ConversationMessage[]): AnthropicMessage[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        };
      }

      // Handle complex content with images/documents
      const content: Array<{ type: string; text?: string; image?: { type: string; media_type: string; data: string } }> = [];
      
      for (const item of msg.content) {
        if (item.type === 'text') {
          content.push({
            type: 'text',
            text: item.text
          });
        } else if (item.type === 'image') {
          // Extract base64 data and mime type from data URL
          const match = item.image.url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            content.push({
              type: 'image',
              image: {
                type: 'base64',
                media_type: match[1],
                data: match[2]
              }
            });
          }
        } else if (item.type === 'document') {
          // Convert document to text for Anthropic
          content.push({
            type: 'text',
            text: `[Document: ${item.document.name}]\n${item.document.content || 'Document content not available'}`
          });
        }
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: content.length === 1 && content[0].type === 'text' ? content[0].text! : content
      };
    });
  }

  /**
   * Convert internal message format to Gemini format
   */
  static toGemini(messages: ConversationMessage[]): GeminiMessage[] {
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      
      if (typeof msg.content === 'string') {
        return {
          role,
          parts: [{ text: msg.content }]
        };
      }

      // Handle complex content with images/documents
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      
      for (const item of msg.content) {
        if (item.type === 'text') {
          parts.push({ text: item.text });
        } else if (item.type === 'image') {
          // Extract base64 data and mime type from data URL
          const match = item.image.url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        } else if (item.type === 'document') {
          // Convert document to text for Gemini
          parts.push({
            text: `[Document: ${item.document.name}]\n${item.document.content || 'Document content not available'}`
          });
        }
      }

      return { role, parts };
    });
  }

  /**
   * Convert current message to provider-specific format
   */
  static convertCurrentMessage(message: MessageContent, format: 'openai' | 'anthropic' | 'gemini'): unknown {
    if (typeof message === 'string') {
      switch (format) {
        case 'openai':
        case 'anthropic':
          return message;
        case 'gemini':
          return [{ text: message }];
      }
    }

    // Handle complex message content
    switch (format) {
      case 'openai':
        return this.toOpenAI([{ role: 'user', content: message }])[0].content;
      case 'anthropic':
        return this.toAnthropic([{ role: 'user', content: message }])[0].content;
      case 'gemini':
        return this.toGemini([{ role: 'user', content: message }])[0].parts;
    }
  }

  /**
   * Extract text content from any message format
   */
  static extractTextContent(content: string | Array<ContentItem>): string {
    if (typeof content === 'string') {
      return content;
    }

    let textContent = '';
    for (const item of content) {
      if (item.type === 'text') {
        textContent += item.text + '\n';
      } else if (item.type === 'document') {
        textContent += `[Document: ${item.document.name}]\n`;
        if (item.document.content) {
          textContent += item.document.content + '\n';
        }
      } else if (item.type === 'image') {
        textContent += `[Image: ${item.image.url}]\n`;
      }
    }

    return textContent.trim();
  }

  /**
   * Check if message contains file uploads
   */
  static hasFileUploads(content: string | Array<ContentItem>): boolean {
    if (typeof content === 'string') {
      return false;
    }

    return content.some(item => item.type === 'document' || item.type === 'image');
  }

  /**
   * Get file uploads from message content
   */
  static getFileUploads(content: string | Array<ContentItem>): Array<{ type: 'document' | 'image'; data: unknown }> {
    if (typeof content === 'string') {
      return [];
    }

    return content
      .filter(item => item.type === 'document' || item.type === 'image')
      .map(item => ({
        type: item.type as 'document' | 'image',
        data: item.type === 'document' ? item.document : item.image
      }));
  }

  /**
   * Merge system prompt with conversation history for providers that don't support system messages
   */
  static mergeSystemPromptWithHistory(
    systemPrompt: string,
    messages: ConversationMessage[]
  ): ConversationMessage[] {
    if (!systemPrompt || messages.length === 0) {
      return messages;
    }

    const firstMessage = messages[0];
    if (firstMessage.role === 'user') {
      // Prepend system prompt to first user message
      const updatedContent = typeof firstMessage.content === 'string'
        ? `${systemPrompt}\n\n${firstMessage.content}`
        : [
            { type: 'text' as const, text: systemPrompt },
            ...firstMessage.content
          ];

      return [
        { ...firstMessage, content: updatedContent },
        ...messages.slice(1)
      ];
    }

    return messages;
  }

  /**
   * Validate message format for specific provider
   */
  static validateForProvider(
    messages: ConversationMessage[],
    provider: 'openai' | 'anthropic' | 'gemini' | 'ollama'
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [index, message] of messages.entries()) {
      // Check role validity
      const validRoles = provider === 'gemini' ? ['user', 'model'] : ['user', 'assistant', 'system'];
      if (!validRoles.includes(message.role)) {
        errors.push(`Message ${index}: Invalid role '${message.role}' for ${provider}`);
      }

      // Check content format
      if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
        errors.push(`Message ${index}: Invalid content format`);
      }

      // Provider-specific validations
      if (provider === 'anthropic') {
        // Anthropic doesn't support system role in messages
        if (message.role === 'system') {
          errors.push(`Message ${index}: Anthropic doesn't support system role in messages`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
