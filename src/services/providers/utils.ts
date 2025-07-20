// Shared utilities for LLM providers

import { ToolCallArguments } from './types';

// Response parser utility for cleaning up structured responses
export class ResponseParser {
  // Parse XML-like tags (e.g., <Simple>content</Simple>)
  static parseXMLTags(text: string): string {
    // Remove XML-like tags and extract content
    return text.replace(/<[^>]+>/g, '').trim();
  }

  // Parse JSON arrays and extract meaningful content
  static parseJSONArray(data: unknown[]): string {
    if (!Array.isArray(data)) return '';

    const results: string[] = [];

    for (const item of data) {
      if (typeof item === 'string') {
        results.push(item);
      } else if (typeof item === 'object' && item !== null) {
        // Extract common fields
        const obj = item as Record<string, unknown>;
        const content = obj.output || obj.response || obj.message || obj.content || obj.text || obj.result;
        if (content) {
          results.push(typeof content === 'string' ? content : JSON.stringify(content));
        } else {
          results.push(JSON.stringify(item));
        }
      }
    }

    return results.join('\n\n');
  }

  // Parse structured responses and clean them up
  static parseStructuredResponse(responseText: string): string {
    try {
      // First try to parse as JSON
      const data = JSON.parse(responseText);

      if (Array.isArray(data)) {
        // Handle JSON arrays like [{"output":"<Simple>content</Simple>"}]
        const parsed = this.parseJSONArray(data);
        return this.parseXMLTags(parsed);
      } else if (typeof data === 'object' && data !== null) {
        // Handle single objects
        const content = data.output || data.response || data.message || data.content || data.text || data.result;
        if (content) {
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          return this.parseXMLTags(contentStr);
        }
        return JSON.stringify(data);
      } else {
        // Handle primitive values
        const contentStr = String(data);
        return this.parseXMLTags(contentStr);
      }
    } catch {
      // If JSON parsing fails, try to clean up XML tags from raw text
      return this.parseXMLTags(responseText);
    }
  }

  // Main parsing function that handles various response formats
  static cleanResponse(responseText: string): string {
    if (!responseText || !responseText.trim()) {
      return '';
    }

    const trimmed = responseText.trim();

    // Check if it looks like a JSON response
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      return this.parseStructuredResponse(trimmed);
    }

    // Check if it contains XML-like tags
    if (trimmed.includes('<') && trimmed.includes('>')) {
      return this.parseXMLTags(trimmed);
    }

    // Return as-is if no special formatting detected
    return trimmed;
  }
}

// Token estimation utility
export class TokenEstimator {
  // Simple token estimation (roughly 4 characters per token for most models)
  static estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate estimation: count words, punctuation, and apply scaling
    const words = text.split(/\s+/).length;
    const chars = text.length;
    // Rough estimation: 0.75 tokens per word + 0.25 tokens per 4 characters
    return Math.ceil(words * 0.75 + chars * 0.25 / 4);
  }

  static createEstimatedUsage(promptText: string, responseText: string, label: string = 'estimated'): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    const promptTokens = this.estimateTokens(promptText);
    const completionTokens = this.estimateTokens(responseText);
    const totalTokens = promptTokens + completionTokens;

    console.log(`📊 ${label} token usage:`, {
      promptTokens,
      completionTokens,
      totalTokens,
      promptChars: promptText.length,
      responseChars: responseText.length
    });

    return { promptTokens, completionTokens, totalTokens };
  }
}

// JSON parsing utilities
export class JSONUtils {
  static extractArgumentsFromMalformedJson(jsonString: string): Record<string, unknown> {
    try {
      console.log(`🔧 Attempting to extract arguments from malformed JSON:`, jsonString);

      // Try to fix common JSON issues
      let fixedJson = jsonString;

      // Fix unterminated strings by adding closing quotes
      const openQuotes = (fixedJson.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        fixedJson += '"';
      }

      // Try to close unclosed braces
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedJson += '}';
      }

      // Try parsing the fixed JSON
      try {
        return JSON.parse(fixedJson);
      } catch {
        console.warn('Failed to parse fixed JSON, trying regex extraction');
      }

      // Fallback: extract key-value pairs using regex
      const args: Record<string, unknown> = {};

      // Extract "key": "value" patterns
      const keyValueRegex = /"([^"]+)":\s*"([^"]*)"/g;
      let match;
      while ((match = keyValueRegex.exec(jsonString)) !== null) {
        args[match[1]] = match[2];
      }

      // Extract "key": value patterns (without quotes on value)
      const keyValueNoQuotesRegex = /"([^"]+)":\s*([^,}\s]+)/g;
      while ((match = keyValueNoQuotesRegex.exec(jsonString)) !== null) {
        if (!args[match[1]]) { // Don't overwrite existing values
          args[match[1]] = match[2];
        }
      }

      console.log(`🔧 Extracted arguments from malformed JSON:`, args);
      return args;

    } catch (error) {
      console.error('Failed to extract arguments from malformed JSON:', error);
      return {};
    }
  }

  /**
   * Extract a complete JSON object starting from a given position
   * Uses proper brace counting to handle nested objects
   */
  static extractCompleteJSON(content: string, startIndex: number): { jsonStr: string; endIndex: number } | null {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let i = startIndex;

    while (i < content.length) {
      const char = content[i];

      if (escaped) {
        escaped = false;
      } else if (char === '\\' && inString) {
        escaped = true;
      } else if (char === '"') {
        inString = !inString;
      } else if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Found complete JSON object
            const jsonStr = content.substring(startIndex, i + 1);
            return { jsonStr, endIndex: i };
          }
        }
      }

      i++;
    }

    return null; // No complete JSON object found
  }
}

// Tool name utilities
export class ToolNameUtils {
  /**
   * Truncate tool names for Anthropic's 64-character limit while preserving meaning
   */
  static truncateToolNameForAnthropic(toolName: string): string {
    if (toolName.length <= 64) {
      return toolName;
    }

    // Strategy: Keep the most important parts and use abbreviations
    let truncated = toolName;

    // Dynamic abbreviations to reduce length
    const abbreviations: Record<string, string> = {
      'SEARCH': 'SRCH',
      'BROWSER': 'BRWS',
      'MEMORY': 'MEM',
      'DATETIME': 'DT',
      'ANALYSIS': 'ANLYS',
      'FUNCTION': 'FN',
      'REQUEST': 'REQ',
      'RESPONSE': 'RESP',
      'DATABASE': 'DB',
      'DOCUMENT': 'DOC'
    };

    // Apply abbreviations
    for (const [full, abbrev] of Object.entries(abbreviations)) {
      truncated = truncated.replace(new RegExp(full, 'gi'), abbrev);
    }

    // If still too long, truncate from the end but keep meaningful prefix
    if (truncated.length > 64) {
      truncated = truncated.substring(0, 61) + '...';
    }

    return truncated;
  }
}

// Model support utilities
export class ModelUtils {
  static checkModelToolSupport(model: string): boolean {
    // Be permissive - assume most modern models support tools
    // Only exclude models that are known NOT to support tools
    const unsupportedModels = [
      'text-davinci',
      'text-curie',
      'text-babbage',
      'text-ada',
      'code-davinci',
      'gpt-3.5-turbo-instruct'
    ];

    // Check if the model is in the unsupported list
    const isUnsupported = unsupportedModels.some(unsupportedModel =>
      model.toLowerCase().includes(unsupportedModel.toLowerCase())
    );

    // Default to supporting tools unless explicitly unsupported
    return !isUnsupported;
  }
}




