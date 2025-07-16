# Multi-Tool System Troubleshooting Guide

## Common Issues and Solutions

### Tool Execution Failures

#### Issue: "Tool call validation failed"
**Symptoms:**
- Console warnings about validation failures
- Tools not executing despite being called
- Provider-specific error messages

**Causes:**
- Missing required fields (id, name, arguments)
- Invalid tool name format
- Provider-specific requirement violations

**Solutions:**
```typescript
// Check tool call format
const toolCall = {
  id: 'unique-id',        // Required for OpenAI
  name: 'web_search',     // Must be valid identifier
  arguments: {            // Must be object, not string
    query: 'search term'
  }
};

// Validate before execution
const validation = llmService.validateToolCallsForProvider([toolCall], 'openai');
if (!validation.valid) {
  console.error('Fix these issues:', validation.errors);
}
```

#### Issue: "Tool execution timeout"
**Symptoms:**
- Tools hanging indefinitely
- Timeout error messages
- Partial results returned

**Causes:**
- Network connectivity issues
- Overloaded MCP servers
- Large data processing

**Solutions:**
```typescript
// Increase timeout for slow operations
const results = await executeMultipleToolsParallel(toolCalls, provider, {
  timeout: 30000 // 30 seconds instead of default 10
});

// Implement retry logic
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  backoffFactor: 2
};
```

### Provider-Specific Issues

#### OpenAI Provider

**Issue: "Function name too long"**
```typescript
// ❌ Bad: Name exceeds 64 characters
const badTool = {
  name: 'this_is_a_very_long_tool_name_that_exceeds_the_sixty_four_character_limit'
};

// ✅ Good: Short, descriptive name
const goodTool = {
  name: 'web_search'
};
```

**Issue: "Missing tool call ID"**
```typescript
// ❌ Bad: Missing required ID
const badCall = {
  name: 'web_search',
  arguments: { query: 'test' }
};

// ✅ Good: Include unique ID
const goodCall = {
  id: 'call_123',
  name: 'web_search',
  arguments: { query: 'test' }
};
```

#### Anthropic Provider

**Issue: "Tool calls not executing in parallel"**
**Cause:** Anthropic models may stop after one tool call
**Solution:**
```typescript
// Use sequential prompting strategy
const followUpPrompt = `Continue with the remaining tools: ${remainingTools.join(', ')}`;
```

#### Ollama Provider

**Issue: "Native API not parsing tool calls"**
**Symptoms:**
- Tools output as JSON text instead of function calls
- No tool execution despite tool calls in response

**Solutions:**
```typescript
// Ensure proper tool format for Ollama
const ollamaTools = tools.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

// Check Ollama version compatibility
// Requires Ollama 0.1.26+ for tool calling
```

### Memory System Issues

#### Issue: "Memory search returns no results"
**Symptoms:**
- Empty search results despite stored memories
- Poor search relevance

**Causes:**
- Exact keyword matching limitations
- Insufficient search context
- Memory storage format issues

**Solutions:**
```typescript
// Use broader search terms
const results = await executeTool('memory_search', {
  text: 'weather preferences location', // Multiple keywords
  limit: 10 // Increase result limit
});

// Check memory storage format
await executeTool('memory_store', {
  title: 'User Weather Preferences',
  content: 'User prefers Celsius, morning updates, detailed forecasts',
  type: 'user_preference',
  tags: ['weather', 'preferences', 'settings']
});
```

#### Issue: "Memory system performance degradation"
**Symptoms:**
- Slow memory operations
- High memory usage
- Search timeouts

**Solutions:**
```typescript
// Regular cleanup of old memories
await executeTool('memory_delete', {
  olderThan: '30d',
  type: 'temporary'
});

// Optimize search queries
const optimizedSearch = await executeTool('memory_search', {
  text: 'specific keywords',
  type: 'user_preference', // Filter by type
  limit: 5 // Limit results
});
```

### Performance Issues

#### Issue: "Slow tool execution"
**Symptoms:**
- High response times
- User interface lag
- Timeout errors

**Diagnostic Steps:**
```typescript
// Enable performance monitoring
const startTime = performance.now();
const results = await executeMultipleToolsParallel(toolCalls, provider);
const executionTime = performance.now() - startTime;
console.log(`Execution time: ${executionTime}ms`);

// Identify slow tools
results.forEach(result => {
  if (result.executionTime > 5000) {
    console.warn(`Slow tool: ${result.name} took ${result.executionTime}ms`);
  }
});
```

**Solutions:**
```typescript
// Use parallel execution for independent tools
const parallelTools = [
  { name: 'web_search', arguments: { query: 'weather' } },
  { name: 'get_datetime', arguments: {} }
];

// Implement caching for frequently used results
const cacheKey = generateCacheKey(toolCall);
const cachedResult = cache.get(cacheKey);
if (cachedResult) {
  return cachedResult;
}
```

### Network and Connectivity Issues

#### Issue: "MCP server connection failures"
**Symptoms:**
- "MCP service not available" errors
- Intermittent tool failures
- Connection timeouts

**Diagnostic Steps:**
```typescript
// Check MCP server status
const servers = await window.electronAPI.getMCPServers();
const connectedServers = await window.electronAPI.getConnectedMCPServerIds();
console.log('Available servers:', servers);
console.log('Connected servers:', connectedServers);
```

**Solutions:**
```typescript
// Implement connection retry logic
const retryConnection = async (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await executeTool(toolCall);
      return result;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
};
```

### Debugging Tools

#### Enable Debug Logging
```typescript
// Set environment variable
process.env.DEBUG_TOOLS = 'true';

// Or enable in code
const debugMode = true;
if (debugMode) {
  console.log('🔍 Tool execution debug info:', {
    toolCalls,
    provider,
    timestamp: new Date().toISOString()
  });
}
```

#### Tool Execution Monitoring
```typescript
// Monitor tool performance
class ToolMonitor {
  static logExecution(toolName: string, executionTime: number, success: boolean) {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${toolName}: ${executionTime}ms`);
    
    // Log to analytics service
    this.sendMetrics({
      tool: toolName,
      duration: executionTime,
      success,
      timestamp: Date.now()
    });
  }
}
```

#### Memory Usage Tracking
```typescript
// Monitor memory usage
const getMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }
  return null;
};

console.log('Memory usage:', getMemoryUsage());
```

### Error Recovery Strategies

#### Graceful Degradation
```typescript
const executeWithFallback = async (toolCalls: ToolCall[], provider: string) => {
  try {
    return await executeMultipleToolsParallel(toolCalls, provider);
  } catch (error) {
    console.warn('Primary execution failed, trying fallback:', error);
    
    // Try with reduced tool set
    const essentialTools = toolCalls.filter(tc => tc.name !== 'optional_tool');
    return await executeMultipleToolsParallel(essentialTools, provider);
  }
};
```

#### Partial Result Handling
```typescript
const handlePartialResults = (results: ToolResult[]) => {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (failed.length > 0) {
    console.warn(`${failed.length} tools failed:`, failed.map(f => f.name));
  }
  
  if (successful.length === 0) {
    throw new Error('All tools failed');
  }
  
  // Continue with partial results
  return processPartialResults(successful);
};
```

### Prevention Best Practices

#### Input Validation
```typescript
const validateToolCall = (toolCall: ToolCall): boolean => {
  if (!toolCall.name || typeof toolCall.name !== 'string') {
    console.error('Invalid tool name:', toolCall.name);
    return false;
  }
  
  if (!toolCall.arguments || typeof toolCall.arguments !== 'object') {
    console.error('Invalid tool arguments:', toolCall.arguments);
    return false;
  }
  
  return true;
};
```

#### Resource Management
```typescript
// Implement connection pooling
class ConnectionPool {
  private connections = new Map();
  private maxConnections = 10;
  
  async getConnection(server: string) {
    if (!this.connections.has(server)) {
      if (this.connections.size >= this.maxConnections) {
        // Clean up oldest connection
        const oldest = this.connections.keys().next().value;
        this.connections.delete(oldest);
      }
      this.connections.set(server, await createConnection(server));
    }
    return this.connections.get(server);
  }
}
```

#### Health Monitoring
```typescript
// Regular health checks
const healthCheck = async () => {
  const checks = [
    { name: 'MCP Service', check: () => mcpService.isHealthy() },
    { name: 'Memory Service', check: () => memoryService.isHealthy() },
    { name: 'Network', check: () => testNetworkConnectivity() }
  ];
  
  for (const { name, check } of checks) {
    try {
      const healthy = await check();
      console.log(`${healthy ? '✅' : '❌'} ${name}`);
    } catch (error) {
      console.error(`❌ ${name}:`, error.message);
    }
  }
};

// Run health check every 5 minutes
setInterval(healthCheck, 5 * 60 * 1000);
```

## Getting Help

### Log Collection
When reporting issues, include:
1. Console logs with debug mode enabled
2. Tool execution results and errors
3. Provider and model information
4. Network connectivity status
5. MCP server configuration

### Support Channels
- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: Check docs/ directory for detailed guides
- **Test Suite**: Run tests to verify system functionality
- **Debug Mode**: Enable detailed logging for troubleshooting

---

*For additional support, see the main documentation and API reference guides.*
