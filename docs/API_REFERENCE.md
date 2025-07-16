# Multi-Tool System API Reference

## Core Classes

### LLMService

The main service class for managing LLM providers and tool execution.

#### Methods

##### `executeMultipleToolsParallel(toolCalls, provider)`

Executes multiple tools in parallel with optimized performance.

**Parameters:**
- `toolCalls: Array<ToolCall>` - Array of tool calls to execute
- `provider: string` - LLM provider identifier

**Returns:** `Promise<Array<ToolResult>>`

**Example:**
```typescript
const results = await llmService.executeMultipleToolsParallel([
  { name: 'web_search', arguments: { query: 'AI news' } },
  { name: 'get_datetime', arguments: {} }
], 'openai');
```

##### `validateToolCallsForProvider(toolCalls, provider)`

Validates tool calls for provider-specific requirements.

**Parameters:**
- `toolCalls: Array<ToolCall>` - Tool calls to validate
- `provider: string` - Provider to validate against

**Returns:** `{ valid: boolean; errors: string[] }`

**Example:**
```typescript
const validation = llmService.validateToolCallsForProvider(toolCalls, 'anthropic');
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

##### `sendMessage(message, settings, conversationHistory, streaming)`

Sends a message to an LLM provider with tool support.

**Parameters:**
- `message: string` - User message
- `settings: LLMSettings` - Provider configuration
- `conversationHistory: Array<Message>` - Previous messages
- `streaming: boolean` - Enable streaming response

**Returns:** `Promise<LLMResponse>`

### MCPService

Handles Model Context Protocol tool integration.

#### Methods

##### `callToolsOptimized(toolCalls)`

Executes MCP tools with optimized performance.

**Parameters:**
- `toolCalls: Array<ToolCall>` - Tools to execute

**Returns:** `Promise<Array<ToolResult>>`

##### `getAllMCPTools()`

Retrieves all available MCP tools.

**Returns:** `Promise<Array<MCPTool>>`

## Type Definitions

### ToolCall

```typescript
interface ToolCall {
  id?: string;           // Unique identifier (required for some providers)
  name: string;          // Tool name
  arguments: object;     // Tool parameters
}
```

### ToolResult

```typescript
interface ToolResult {
  id?: string;           // Tool call identifier
  name: string;          // Tool name
  result: any;           // Tool execution result
  success: boolean;      // Execution success status
  error?: string;        // Error message if failed
  executionTime: number; // Execution time in milliseconds
  serverUsed?: string;   // MCP server that handled the tool
}
```

### LLMSettings

```typescript
interface LLMSettings {
  provider: string;      // Provider identifier
  model: string;         // Model name
  apiKey: string;        // API key
  baseUrl?: string;      // Custom base URL
  temperature: number;   // Response randomness (0-1)
  maxTokens: number;     // Maximum response tokens
  systemPrompt?: string; // System prompt override
  toolCallingEnabled?: boolean; // Enable tool calling
  memoryContext?: any;   // Memory context
}
```

### LLMResponse

```typescript
interface LLMResponse {
  content: string;       // Response content
  usage?: {              // Token usage statistics
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<ToolCall>; // Tool calls made by the model
}
```

## Tool Categories

### Search Tools

#### web_search
Performs web search using SearXNG.

**Parameters:**
```typescript
{
  query: string;         // Search query
  categories?: string[]; // Search categories (news, general, etc.)
  language?: string;     // Search language
  page?: number;         // Results page
  time_range?: string;   // Time filter
  safe_search?: number;  // Safe search level
}
```

#### fetch
Retrieves content from a URL.

**Parameters:**
```typescript
{
  url: string;          // URL to fetch
  method?: string;      // HTTP method (default: GET)
  headers?: object;     // HTTP headers
}
```

### Memory Tools

#### memory_store
Stores information in persistent memory.

**Parameters:**
```typescript
{
  title: string;        // Memory title
  content: string;      // Memory content
  type?: string;        // Memory type
  tags?: string[];      // Memory tags
}
```

#### memory_search
Searches stored memories.

**Parameters:**
```typescript
{
  text: string;         // Search query
  type?: string;        // Memory type filter
  tags?: string[];      // Tag filters
  limit?: number;       // Result limit
}
```

### Utility Tools

#### get_datetime
Gets current date/time information.

**Parameters:**
```typescript
{
  format?: string;      // Format type (date, time, datetime)
  timezone?: string;    // Timezone identifier
}
```

#### sequentialthinking
Enables complex reasoning workflows.

**Parameters:**
```typescript
{
  thought: string;      // Current thinking step
  nextThoughtNeeded: boolean; // Whether more thinking is needed
  thoughtNumber: number; // Current thought number
  totalThoughts: number; // Estimated total thoughts
}
```

## Provider-Specific Configurations

### OpenAI

**Tool Format:**
```typescript
{
  type: "function",
  function: {
    name: string,
    description: string,
    parameters: object
  }
}
```

**Requirements:**
- Tool calls must have unique IDs
- Function names ≤64 characters
- Parameters must be valid JSON schema

### Anthropic

**Tool Format:**
```typescript
{
  name: string,
  description: string,
  input_schema: {
    type: "object",
    properties: object,
    required?: string[]
  }
}
```

**Requirements:**
- Tool names must be valid identifiers
- Descriptions are required
- Input schema must be valid JSON schema

### Ollama

**Tool Format (Native):**
```typescript
{
  type: "function",
  function: {
    name: string,
    description: string,
    parameters: {
      type: "object",
      properties: object,
      required?: string[]
    }
  }
}
```

**Requirements:**
- Supports both native and OpenAI-compatible formats
- Streaming responses supported
- Conversation history maintained

## Error Handling

### Error Types

#### ValidationError
Tool call validation failed.

```typescript
{
  type: 'ValidationError',
  message: string,
  errors: string[],
  provider: string
}
```

#### ExecutionError
Tool execution failed.

```typescript
{
  type: 'ExecutionError',
  message: string,
  toolName: string,
  originalError: Error
}
```

#### TimeoutError
Tool execution timed out.

```typescript
{
  type: 'TimeoutError',
  message: string,
  toolName: string,
  timeout: number
}
```

### Error Recovery

```typescript
// Automatic retry with exponential backoff
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
};

// Fallback tool selection
const fallbackTools = {
  'web_search': ['fetch', 'memory_search'],
  'memory_search': ['web_search'],
  'get_datetime': [] // No fallback available
};
```

## Performance Optimization

### Parallel Execution

```typescript
// Optimal for independent operations
const parallelResults = await executeMultipleToolsParallel([
  { name: 'web_search', arguments: { query: 'weather' } },
  { name: 'get_datetime', arguments: {} },
  { name: 'memory_search', arguments: { text: 'preferences' } }
], provider);
```

### Sequential Execution

```typescript
// Use when tools depend on each other
const searchResult = await executeTool('web_search', { query: 'data' });
const analysis = await executeTool('analyze', { data: searchResult });
const stored = await executeTool('memory_store', { content: analysis });
```

### Caching

```typescript
// Enable result caching
const cachedResults = await executeWithCache(toolCalls, {
  ttl: 300000, // 5 minutes
  key: generateCacheKey(toolCalls)
});
```

## Examples

### Multi-Information Request

```typescript
// User asks: "What's the weather, date, and latest news?"
const toolCalls = [
  { name: 'get_datetime', arguments: { format: 'date' } },
  { name: 'web_search', arguments: { query: 'weather forecast' } },
  { name: 'web_search', arguments: { query: 'latest news', categories: ['news'] } }
];

const results = await llmService.executeMultipleToolsParallel(toolCalls, 'anthropic');

// Process and synthesize results
const response = synthesizeResults(results);
```

### Research Workflow

```typescript
// Complex research task with chaining
const topic = 'artificial intelligence trends';

// Step 1: Search for information
const searchResults = await executeTool('web_search', { 
  query: topic,
  categories: ['news', 'general']
});

// Step 2: Store findings
await executeTool('memory_store', {
  title: `Research: ${topic}`,
  content: searchResults.result,
  type: 'research',
  tags: ['ai', 'trends', 'research']
});

// Step 3: Get related memories
const relatedMemories = await executeTool('memory_search', {
  text: topic,
  type: 'research',
  limit: 5
});

// Step 4: Synthesize comprehensive response
const synthesis = await executeTool('sequentialthinking', {
  thought: `Analyzing ${topic} based on current search and historical data`,
  nextThoughtNeeded: true,
  thoughtNumber: 1,
  totalThoughts: 3
});
```

---

*For more examples and advanced usage patterns, see the documentation in the docs/ directory.*
