# Prompt Caching Implementation Guide

## Overview

LittleLLM now supports prompt caching across multiple providers through OpenRouter and direct provider APIs. This implementation provides significant cost savings (50-90% on cached tokens) and faster response times.

## Supported Providers

### OpenRouter (All Models)
- **OpenAI Models**: Automatic caching (≥1024 tokens)
- **Anthropic Claude**: Manual caching with `cache_control` parameters
- **Google Gemini**: Both implicit (automatic) and explicit (manual) caching
- **Grok**: Automatic caching
- **DeepSeek**: Automatic caching

### Direct Provider APIs ✅ **FULLY IMPLEMENTED**
- **Anthropic**: Manual caching with `cache_control` parameters
  - System prompts >4096 chars get cache_control
  - Large user messages >4096 chars get cache_control
  - Last content item in arrays gets cache_control
- **OpenAI**: Automatic caching (≥1024 tokens)
  - Logs caching eligibility for system prompts and messages
  - Optimizes message structure for cache hits
- **Google Gemini**: Both implicit and explicit caching
  - System instructions >8192 chars get explicit cache_control
  - Large content gets implicit caching eligibility logging
  - Supports both cache_control and automatic caching

## Implementation Details

### 1. Provider Capabilities

Each provider now declares its caching support:

```typescript
interface ProviderCapabilities {
  supportsPromptCaching?: boolean;
  promptCachingType?: 'automatic' | 'manual' | 'both';
  // ... other capabilities
}
```

### 2. Settings Integration

Added `promptCachingEnabled` to LLMSettings:

```typescript
interface LLMSettings {
  promptCachingEnabled?: boolean; // Default: true
  // ... other settings
}
```

### 3. Content Item Extensions

Extended ContentItem to support cache_control:

```typescript
interface ContentItem {
  cache_control?: {
    type: 'ephemeral';
  };
  // ... other properties
}
```

### 4. Automatic Cache Control

The system automatically adds `cache_control` to:
- **System prompts** (for manual caching providers)
- **Large text content** (>1024 tokens estimated)
- **Last content item** in message arrays (for optimal caching)

## Usage Examples

### Basic Usage (Automatic)

```typescript
const settings: LLMSettings = {
  provider: 'openrouter',
  model: 'anthropic/claude-3-5-sonnet',
  apiKey: 'your-key',
  promptCachingEnabled: true // Default: true
};

// System prompts and large content automatically get cache_control
```

### Manual Cache Control

```typescript
const messageWithCaching: ContentItem[] = [
  {
    type: 'text',
    text: 'Context: Here is a large document...',
    cache_control: { type: 'ephemeral' }
  },
  {
    type: 'text',
    text: 'Question: What does this document say about...?'
  }
];
```

## Cost Savings

### OpenRouter Pricing Changes

| Provider | Cache Writes | Cache Reads |
|----------|-------------|-------------|
| **OpenAI** | No cost | 0.25x-0.50x original price |
| **Anthropic** | 1.25x original price | 0.1x original price |
| **Gemini** | Input price + 5min storage | 0.25x original price |
| **Grok** | No cost | 0.25x original price |
| **DeepSeek** | Same as original | 0.1x original price |

### Cache Limitations

- **Anthropic**: 4 breakpoints max, 5-minute TTL
- **OpenAI**: 1024+ tokens minimum, automatic
- **Gemini**: 1028+ tokens (Flash), 2048+ tokens (Pro), 5-minute TTL
- **Grok/DeepSeek**: Automatic, provider-managed

## Best Practices

### 1. Structure for Caching

```typescript
// Good: Large context first, questions last
const messages = [
  {
    role: 'system',
    content: [
      { type: 'text', text: 'You are an expert...' },
      { 
        type: 'text', 
        text: 'LARGE_REFERENCE_DOCUMENT',
        cache_control: { type: 'ephemeral' }
      }
    ]
  },
  {
    role: 'user',
    content: 'What does the document say about X?'
  }
];
```

### 2. Optimize Cache Hits

- Keep consistent prompt prefixes
- Place variable content at the end
- Use large, reusable content blocks
- Minimize cache breakpoints

### 3. Monitor Usage

Check cache usage through:
- OpenRouter Activity page
- API response `cache_discount` field
- Usage accounting with `usage: {include: true}`

## Configuration

### Enable/Disable Caching

```typescript
// In settings
const settings = {
  promptCachingEnabled: true, // Default: true
  // ... other settings
};
```

### Provider-Specific Behavior

The system automatically:
- Detects underlying provider from model name
- Applies appropriate caching strategy
- Handles provider-specific formats
- Optimizes for cache hits

## Testing

Run the prompt caching tests:

```bash
npm test src/test/prompt-caching.test.ts
```

Tests cover:
- Provider capability detection
- Cache control addition logic
- Content size thresholds
- Provider-specific formatting

## Troubleshooting

### Common Issues

1. **No cache hits**: Ensure content >1024 tokens and consistent structure
2. **High cache write costs**: Limit Anthropic breakpoints to large, reusable content
3. **Cache misses**: Keep prompt prefixes consistent between requests

### Debug Logging

Enable debug logging to see caching decisions:

```typescript
console.log(`🔧 OpenRouter underlying provider supports manual caching: ${supportsManualCaching}`);
console.log(`🔧 OpenRouter caching enabled: ${cachingEnabled}`);
```

## Future Enhancements

- Cache analytics dashboard
- Smart cache breakpoint optimization
- Provider-specific cache strategies
- Cache hit rate monitoring
- Automatic cache optimization suggestions
