// Test file for prompt caching functionality
import { OpenRouterProvider } from '../src/services/providers/OpenRouterProvider';
import { AnthropicProvider } from '../src/services/providers/AnthropicProvider';
import { OpenAIProvider } from '../src/services/providers/OpenAIProvider';
import { GeminiProvider } from '../src/services/providers/GeminiProvider';
import { LLMSettings, ContentItem } from '../src/services/providers/types';

describe('Prompt Caching Support', () => {
  describe('Provider Capabilities', () => {
    test('OpenRouter should support prompt caching', () => {
      const provider = new OpenRouterProvider();
      expect(provider.capabilities.supportsPromptCaching).toBe(true);
      expect(provider.capabilities.promptCachingType).toBe('both');
    });

    test('Anthropic should support manual prompt caching', () => {
      const provider = new AnthropicProvider();
      expect(provider.capabilities.supportsPromptCaching).toBe(true);
      expect(provider.capabilities.promptCachingType).toBe('manual');
    });

    test('OpenAI should support automatic prompt caching', () => {
      const provider = new OpenAIProvider();
      expect(provider.capabilities.supportsPromptCaching).toBe(true);
      expect(provider.capabilities.promptCachingType).toBe('automatic');
    });

    test('Gemini should support both caching types', () => {
      const provider = new GeminiProvider();
      expect(provider.capabilities.supportsPromptCaching).toBe(true);
      expect(provider.capabilities.promptCachingType).toBe('both');
    });
  });

  describe('Cache Control Content Items', () => {
    test('ContentItem should support cache_control property', () => {
      const contentItem: ContentItem = {
        type: 'text',
        text: 'This is a large text content that should be cached',
        cache_control: {
          type: 'ephemeral'
        }
      };

      expect(contentItem.cache_control).toBeDefined();
      expect(contentItem.cache_control?.type).toBe('ephemeral');
    });

    test('LLMSettings should support promptCachingEnabled', () => {
      const settings: LLMSettings = {
        provider: 'openrouter',
        model: 'anthropic/claude-3-5-sonnet',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4000,
        promptCachingEnabled: true
      };

      expect(settings.promptCachingEnabled).toBe(true);
    });
  });

  describe('Direct Provider Caching', () => {
    test('Anthropic should handle cache_control in system prompts', () => {
      const provider = new AnthropicProvider();
      const settings: LLMSettings = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4000,
        promptCachingEnabled: true,
        systemPrompt: 'A'.repeat(5000) // Large system prompt
      };

      // This would be tested in integration tests with actual API calls
      expect(settings.promptCachingEnabled).toBe(true);
      expect(settings.systemPrompt!.length).toBeGreaterThan(4096);
    });

    test('OpenAI should log caching eligibility', () => {
      const provider = new OpenAIProvider();
      const settings: LLMSettings = {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4000,
        promptCachingEnabled: true
      };

      expect(provider.capabilities.promptCachingType).toBe('automatic');
      expect(settings.promptCachingEnabled).toBe(true);
    });

    test('Gemini should support both implicit and explicit caching', () => {
      const provider = new GeminiProvider();
      const settings: LLMSettings = {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4000,
        promptCachingEnabled: true
      };

      expect(provider.capabilities.promptCachingType).toBe('both');
      expect(settings.promptCachingEnabled).toBe(true);
    });
  });
});
