# Tool Calling System Documentation

## Overview

The LittleLLM application features a comprehensive tool calling system that enables AI models to execute external tools and functions. The system supports multiple providers and handles both native tool calling and text-based tool detection.

## Architecture

### Core Components

1. **LLM Service** (`src/services/llmService.ts`)
   - Central orchestrator for tool execution
   - Handles tool validation and argument parsing
   - Provides error categorization and user-friendly messages

2. **MCP Service** (`src/services/mcpService.ts`)
   - Manages Model Context Protocol (MCP) server connections
   - Handles tool discovery and execution
   - Provides concurrent and sequential execution modes

3. **Provider Implementations**
   - **LMStudioProvider**: Hybrid native + text-based tool calling
   - **OllamaProvider**: Text-based tool calling with thinking model support
   - **OpenAI/Gemini/Mistral**: Native tool calling support

4. **UI Components**
   - **MessageWithThinking**: Displays tool execution results and thinking processes
   - **Collapsible sections**: For tool calls, execution details, and thinking content

## Tool Calling Flow

### 1. Tool Detection

#### Native Tool Calls (OpenAI-compatible providers)
```typescript
// Model generates structured tool calls
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

#### Text-Based Tool Calls (LM Studio, Ollama)
```typescript
// Model outputs structured JSON
{
  "tool_call": {
    "name": "web_search",
    "arguments": {
      "query": "weather Paris"
    }
  }
}
```

#### Natural Language Tool Detection
```text
// Model expresses intent to use tools
"I'll use web_search to find the current weather in Paris"
"Let me search using web_search with query 'weather Paris'"
```

### 2. Tool Execution

#### Validation Pipeline
1. **Structure Validation**: Check for required fields (id, name, arguments)
2. **Argument Validation**: Ensure arguments are valid JSON and non-empty
3. **Tool-Specific Validation**: Verify required parameters for specific tools
4. **Error Handling**: Categorize and format errors for user feedback

#### Execution Modes
- **Concurrent Execution**: Multiple tools executed in parallel
- **Sequential Execution**: Fallback for when concurrent execution fails
- **Optimized Execution**: Uses MCP server's native concurrent capabilities

### 3. Result Processing

#### Success Flow
1. Tool executes successfully
2. Results are formatted and embedded in response
3. Follow-up call made to model with tool results
4. Model generates response based on tool results

#### Error Flow
1. Tool execution fails
2. Error is categorized and user-friendly message generated
3. Error details included in tool execution summary
4. Model receives error information and responds appropriately

## Supported Tool Types

### Web Search Tools
- `web_search`: General web search with query parameters
- `search`: Alternative search implementation

### File Operations
- `read_file`: Read file contents
- `write_file`: Write content to file
- `edit_file`: Modify existing files

### Web Operations
- `fetch`: Retrieve content from URLs
- `fetch_content`: Enhanced content fetching

### Memory Tools
- `memory-store`: Store information in memory
- `memory-search`: Search stored memories
- `memory-retrieve`: Retrieve specific memories

### Browser Automation
- `puppeteer_navigate`: Navigate to web pages
- `puppeteer_click`: Click elements
- `puppeteer_fill`: Fill form fields

## Error Handling

### Error Categories

1. **Network Errors** (🌐)
   - Connection timeouts
   - Network unavailability
   - DNS resolution failures

2. **Tool Unavailable** (🔧)
   - Tool not found
   - Service configuration issues
   - Temporarily disabled tools

3. **Authentication Errors** (🔐)
   - Invalid API credentials
   - Permission denied
   - Unauthorized access

4. **Rate Limiting** (⏱️)
   - Too many requests
   - Quota exceeded
   - Service overload

5. **Invalid Arguments** (📝)
   - Missing required parameters
   - Invalid parameter values
   - Validation failures

6. **Service Unavailable** (🚫)
   - Server errors (502, 503, 504)
   - Internal service errors
   - Maintenance mode

### Error Display

Errors are displayed in the UI with:
- **Color-coded status**: Red background for failed tools
- **Clear error messages**: User-friendly descriptions
- **Helpful hints**: Suggestions for resolution
- **Technical details**: Available for debugging

## Configuration

### MCP Server Configuration
```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Provider Settings
```typescript
interface LLMSettings {
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  toolCallingEnabled?: boolean;
}
```

## Best Practices

### For Developers

1. **Error Handling**: Always wrap tool execution in try-catch blocks
2. **Validation**: Validate tool arguments before execution
3. **User Feedback**: Provide clear, actionable error messages
4. **Performance**: Use concurrent execution when possible
5. **Fallbacks**: Implement graceful degradation for failed tools

### For Users

1. **Clear Requests**: Be specific about what information you need
2. **Parameter Clarity**: Provide necessary context for tool execution
3. **Error Recovery**: Try rephrasing requests if tools fail
4. **Patience**: Allow time for tool execution to complete

## Troubleshooting

### Common Issues

1. **Tool Not Found**
   - Check MCP server configuration
   - Verify tool is enabled and connected
   - Restart MCP servers if necessary

2. **Empty Arguments**
   - Model may not be generating proper tool calls
   - Check system prompts and tool descriptions
   - Try rephrasing the request

3. **Network Timeouts**
   - Check internet connection
   - Verify API endpoints are accessible
   - Consider increasing timeout values

4. **Authentication Failures**
   - Verify API keys are correct and active
   - Check service account permissions
   - Ensure credentials are properly configured

### Debug Information

Enable debug logging to see:
- Tool call detection and parsing
- Argument validation results
- Execution timing and performance
- Error details and stack traces

## Future Enhancements

1. **Tool Caching**: Cache tool results for repeated queries
2. **Tool Composition**: Chain multiple tools together
3. **Custom Tools**: Allow users to define custom tools
4. **Performance Monitoring**: Track tool execution metrics
5. **Smart Retry**: Automatic retry with exponential backoff
