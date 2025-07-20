# Tool Calling Quick Reference

## Quick Start

### Enable Tool Calling
```typescript
// In provider settings
const settings: LLMSettings = {
  model: 'your-model',
  toolCallingEnabled: true,
  // ... other settings
};
```

### Basic Tool Execution
```typescript
// Execute a single tool
const result = await llmService.executeMCPTool('web_search', {
  query: 'weather Paris'
});
```

## Provider Support Matrix

| Provider | Native Tool Calls | Text-Based | Thinking Models | Concurrent Execution |
|----------|------------------|------------|-----------------|---------------------|
| OpenAI | ✅ | ❌ | ❌ | ✅ |
| Gemini | ✅ | ❌ | ❌ | ✅ |
| Mistral | ✅ | ❌ | ❌ | ✅ |
| LM Studio | ✅ | ✅ | ✅ | ✅ |
| Ollama | ❌ | ✅ | ✅ | ✅ |

## Tool Call Formats

### Native Format (OpenAI-compatible)
```json
{
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "web_search",
        "arguments": "{\"query\": \"weather Paris\"}"
      }
    }
  ]
}
```

### Text-Based Format (LM Studio/Ollama)
```json
{
  "tool_call": {
    "name": "web_search",
    "arguments": {
      "query": "weather Paris"
    }
  }
}
```

### Natural Language Intent
```text
"I'll use web_search to find the weather in Paris"
"Let me search using web_search with query 'weather Paris'"
```

## Common Tools

### Web Search
```typescript
{
  name: 'web_search',
  arguments: {
    query: 'search terms',
    count?: 10,
    time_range?: 'day' | 'week' | 'month' | 'year'
  }
}
```

### File Operations
```typescript
// Read file
{
  name: 'read_file',
  arguments: {
    path: '/path/to/file.txt'
  }
}

// Write file
{
  name: 'write_file',
  arguments: {
    path: '/path/to/file.txt',
    content: 'file content'
  }
}
```

### Memory Tools
```typescript
// Store memory
{
  name: 'memory-store',
  arguments: {
    key: 'user_preference',
    value: 'dark_mode'
  }
}

// Search memory
{
  name: 'memory-search',
  arguments: {
    query: 'user preferences'
  }
}
```

## Error Handling

### Error Categories
- 🌐 **Network**: Connection issues, timeouts
- 🔧 **Tool Unavailable**: Tool not found, disabled
- 🔐 **Authentication**: Invalid credentials, permissions
- ⏱️ **Rate Limit**: Too many requests, quota exceeded
- 📝 **Invalid Arguments**: Missing/invalid parameters
- 🚫 **Service Unavailable**: Server errors, maintenance

### Error Response Format
```typescript
{
  error: true,
  message: "🌐 Network Error: Unable to connect...",
  category: "network",
  toolName: "web_search",
  timestamp: "2024-01-01T12:00:00Z"
}
```

## UI Components

### MessageWithThinking
```tsx
<MessageWithThinking
  content={message.content}
  toolCalls={message.toolCalls}
  isUser={false}
/>
```

### Tool Execution Display
- ✅ **Success**: Green indicator, formatted results
- ❌ **Error**: Red indicator, user-friendly message
- 🧠 **Thinking**: Collapsible section with brain icon
- 🔧 **Tools**: Collapsible section with tool details

## Configuration

### MCP Server Setup
```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-key"
      }
    }
  }
}
```

### Provider Configuration
```typescript
// LM Studio
{
  baseUrl: 'http://localhost:1234/v1',
  model: 'qwen/qwen3-8b',
  toolCallingEnabled: true
}

// Ollama
{
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2',
  toolCallingEnabled: true
}
```

## Debugging

### Enable Debug Logging
```typescript
// In console
localStorage.setItem('debug', 'tool-calling');
```

### Common Debug Points
- Tool call detection: Check parsing logic
- Argument validation: Verify parameter structure
- Execution flow: Monitor tool execution pipeline
- Error handling: Trace error categorization

### Debug Output Examples
```
🔍 LM Studio parsing text for tools
🔧 Executing tool: web_search with args: {...}
✅ Tool executed successfully
❌ Tool execution failed: Network timeout
```

## Performance Tips

### Concurrent Execution
```typescript
// Execute multiple tools in parallel
const results = await llmService.executeMultipleTools([
  { name: 'web_search', arguments: { query: 'weather' } },
  { name: 'web_search', arguments: { query: 'news' } }
]);
```

### Optimization Strategies
- Use concurrent execution for independent tools
- Cache tool results when appropriate
- Implement proper error recovery
- Monitor execution performance

## Best Practices

### For Tool Implementation
1. **Validate inputs** before execution
2. **Handle errors gracefully** with user-friendly messages
3. **Use appropriate timeouts** for network operations
4. **Implement retry logic** for transient failures
5. **Log execution details** for debugging

### For UI Integration
1. **Show execution progress** with loading indicators
2. **Display errors prominently** with clear messages
3. **Make results collapsible** to reduce clutter
4. **Provide retry options** for failed tools
5. **Maintain responsive design** during execution

### For Testing
1. **Test all providers** individually
2. **Verify error handling** for each error type
3. **Check concurrent execution** performance
4. **Validate UI components** display correctly
5. **Test edge cases** and error scenarios

## Troubleshooting

### Tool Not Found
```bash
# Check MCP server status
ps aux | grep mcp

# Restart MCP servers
npm run mcp:restart
```

### Invalid Arguments
```typescript
// Check tool schema
const tools = await mcpService.getAvailableTools();
console.log(tools.find(t => t.name === 'web_search'));
```

### Network Issues
```bash
# Test connectivity
curl -I https://api.example.com

# Check DNS resolution
nslookup api.example.com
```

### Performance Issues
```typescript
// Monitor execution time
console.time('tool-execution');
await executeTool();
console.timeEnd('tool-execution');
```

## API Reference

### LLMService Methods
```typescript
// Execute single tool
executeMCPTool(name: string, args: Record<string, unknown>): Promise<unknown>

// Execute multiple tools
executeMultipleTools(tools: ToolCall[]): Promise<ToolResult[]>

// Get available tools
getAvailableTools(): Promise<ToolObject[]>
```

### MCPService Methods
```typescript
// Call single tool
callTool(name: string, args: Record<string, unknown>): Promise<unknown>

// Call multiple tools (optimized)
callToolsOptimized(tools: ToolCall[]): Promise<ToolResult[]>

// Get tool list
getAvailableTools(): Promise<MCPTool[]>
```

### Provider Methods
```typescript
// Send message with tool calling
sendMessage(
  message: string,
  settings: LLMSettings,
  provider: LLMProvider,
  conversationHistory: Message[],
  onStream: (chunk: string) => void
): Promise<LLMResponse>
```

## Version Compatibility

### Minimum Requirements
- Node.js 18+
- Electron 25+
- TypeScript 5.0+

### MCP Protocol
- Version 1.0+ supported
- Backward compatibility maintained
- Auto-detection of server capabilities

### Model Requirements
- **Native Tool Calling**: OpenAI-compatible function calling
- **Text-Based**: JSON output capability
- **Thinking Models**: Support for reasoning tags
