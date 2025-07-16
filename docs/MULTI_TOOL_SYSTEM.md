# Multi-Tool Agentic System Documentation

## Overview

The LiteLLM Multi-Tool Agentic System enables AI models to execute multiple tools simultaneously or sequentially to accomplish complex tasks. This system provides enhanced capabilities for information gathering, analysis, and task completion across various LLM providers.

## Architecture

### Core Components

1. **LLMService**: Central orchestrator for tool execution and provider management
2. **MCPService**: Handles Model Context Protocol (MCP) tool integration
3. **Tool Validation**: Provider-specific validation and error handling
4. **Parallel Execution**: Optimized concurrent tool execution
5. **Context Management**: Maintains conversation context across tool calls

### Supported Providers

- **OpenAI**: Full multi-tool support with parallel execution
- **Anthropic**: Enhanced tool calling with context preservation
- **Ollama**: Native API integration with streaming support
- **Mistral**: OpenAI-compatible tool calling
- **Google/Gemini**: Schema-validated tool execution
- **Requesty**: Custom provider with tool validation
- **N8N**: Workflow integration support

## Features

### Multi-Tool Strategies

#### Parallel Tool Execution
Execute multiple tools simultaneously for faster results:
```typescript
// Example: Weather + Date + News in parallel
const toolCalls = [
  { name: 'web_search', arguments: { query: 'weather Athens Greece' } },
  { name: 'get_datetime', arguments: { format: 'date' } },
  { name: 'web_search', arguments: { query: 'latest news Greece' } }
];
```

#### Sequential Tool Chaining
Use results from one tool as input for subsequent tools:
```typescript
// Example: Search → Analyze → Store
1. web_search("market trends")
2. analyze_data(search_results)
3. memory_store(analysis_results)
```

#### Error Recovery & Redundancy
Automatic fallback strategies for failed tools:
- Alternative tool selection
- Retry mechanisms with exponential backoff
- Graceful degradation with partial results

### Tool Categories

#### Information Gathering (4 tools)
- `web_search`: Real-time web search with SearXNG
- `fetch`: Direct URL content retrieval
- `memory_search`: Search stored conversation context
- `search_nodes`: Knowledge graph node search

#### Memory & Context (5 tools)
- `memory_store`: Persistent information storage
- `memory_search`: Context retrieval
- `memory_retrieve`: Specific memory access
- `memory_update`: Modify existing memories
- `memory_delete`: Remove outdated information

#### Utility & Analysis (3 tools)
- `get_datetime`: Current date/time information
- `sequentialthinking`: Complex reasoning workflows
- `resolve_library_id`: Package/library resolution

#### API & Integration (8 tools)
- Various MCP server integrations
- External API connections
- Workflow automation tools

## Implementation Guide

### Basic Tool Execution

```typescript
// Single tool execution
const result = await llmService.executeMultipleToolsParallel([
  { name: 'web_search', arguments: { query: 'AI news' } }
], 'openai');

// Multiple tools in parallel
const results = await llmService.executeMultipleToolsParallel([
  { name: 'get_datetime', arguments: {} },
  { name: 'web_search', arguments: { query: 'weather' } },
  { name: 'memory_search', arguments: { text: 'user preferences' } }
], 'anthropic');
```

### Provider-Specific Configuration

#### OpenAI
```typescript
const openaiTools = formatToolsForProvider(tools, 'openai');
// Requires: tool.type = 'function', tool.function.name, tool.id
```

#### Anthropic
```typescript
const anthropicTools = formatToolsForProvider(tools, 'anthropic');
// Requires: tool.name, tool.description, tool.input_schema
```

#### Ollama
```typescript
const ollamaTools = formatToolsForProvider(tools, 'ollama');
// Supports both native and OpenAI-compatible formats
```

### Error Handling

```typescript
try {
  const results = await executeMultipleToolsParallel(toolCalls, provider);
  
  // Check for failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.warn('Some tools failed:', failures);
  }
  
  // Process successful results
  const successes = results.filter(r => r.success);
  return processResults(successes);
  
} catch (error) {
  console.error('Tool execution failed:', error);
  // Implement fallback strategy
}
```

## Best Practices

### Tool Selection
1. **Use appropriate tools** for each information type
2. **Combine complementary tools** for comprehensive results
3. **Prefer parallel execution** when tools are independent
4. **Chain tools logically** when outputs depend on inputs

### Performance Optimization
1. **Batch related operations** to minimize API calls
2. **Cache frequently used results** in memory
3. **Use timeouts** to prevent hanging operations
4. **Monitor execution times** and optimize slow tools

### Error Recovery
1. **Implement retry logic** with exponential backoff
2. **Provide alternative tools** for critical operations
3. **Gracefully handle partial failures** in multi-tool requests
4. **Log errors comprehensively** for debugging

### Context Management
1. **Store important results** in memory for future reference
2. **Maintain conversation continuity** across tool calls
3. **Clean up outdated context** to prevent memory bloat
4. **Use relevant context** to improve tool selection

## Testing

### Unit Tests
```bash
npm run test:unit
```
Tests individual tool validation and execution logic.

### Integration Tests
```bash
npm run test:integration
```
Tests end-to-end workflows across providers and servers.

### Performance Tests
```bash
npm run test:performance
```
Benchmarks tool execution speed and resource usage.

## Troubleshooting

### Common Issues

#### Tool Validation Failures
- **Cause**: Missing required fields (id, name, arguments)
- **Solution**: Check provider-specific requirements
- **Prevention**: Use validation functions before execution

#### Timeout Errors
- **Cause**: Slow network or overloaded services
- **Solution**: Increase timeout values or implement retries
- **Prevention**: Monitor tool performance and set appropriate timeouts

#### Memory Leaks
- **Cause**: Accumulating tool results without cleanup
- **Solution**: Implement result cleanup and memory management
- **Prevention**: Regular memory monitoring and cleanup routines

#### Provider Compatibility
- **Cause**: Tool format incompatibility between providers
- **Solution**: Use provider-specific formatting functions
- **Prevention**: Test tools across all supported providers

### Debug Logging

Enable detailed logging for troubleshooting:
```typescript
// Enable debug mode
process.env.DEBUG_TOOLS = 'true';

// Monitor tool execution
console.log('🚀 Executing tools:', toolNames);
console.log('✅ Results:', results);
console.log('⚠️ Failures:', failures);
```

## Future Enhancements

### Planned Features
1. **Tool Composition**: Combine multiple tools into reusable workflows
2. **Smart Caching**: Intelligent result caching based on context
3. **Load Balancing**: Distribute tool execution across multiple servers
4. **Analytics**: Comprehensive tool usage and performance analytics
5. **Custom Tools**: User-defined tool creation and integration

### Performance Improvements
1. **Connection Pooling**: Reuse connections for better performance
2. **Batch Processing**: Group similar operations for efficiency
3. **Predictive Caching**: Pre-fetch likely needed results
4. **Resource Optimization**: Dynamic resource allocation based on load

## Support

For issues, questions, or contributions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the docs/ directory for detailed guides
- **Tests**: Run the test suite to verify functionality
- **Logs**: Enable debug logging for troubleshooting

---

*This documentation covers the core multi-tool system. For provider-specific details, see the individual provider documentation files.*
