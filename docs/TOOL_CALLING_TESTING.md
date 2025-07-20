# Tool Calling Testing Guide

## Overview

This guide provides comprehensive testing procedures for the tool calling system across different providers and scenarios.

## Test Categories

### 1. Native Tool Calling Tests

#### OpenAI-Compatible Providers (OpenAI, Gemini, Mistral)

**Test Case 1: Basic Web Search**
```
Input: "Search for the current weather in Paris"
Expected: Model generates native tool call for web_search
Validation: Tool executes and returns weather information
```

**Test Case 2: Multiple Tool Calls**
```
Input: "Get the weather in Paris and search for news about AI"
Expected: Model generates multiple tool calls in parallel
Validation: Both tools execute concurrently and results are combined
```

**Test Case 3: Tool Call with Complex Arguments**
```
Input: "Search for Python tutorials published in the last week"
Expected: Tool call with time_range and specific query parameters
Validation: Arguments are properly structured and executed
```

### 2. Text-Based Tool Calling Tests

#### LM Studio Provider

**Test Case 1: Structured JSON Tool Call**
```
Input: "Find information about machine learning"
Expected Output:
{
  "tool_call": {
    "name": "web_search",
    "arguments": {
      "query": "machine learning information"
    }
  }
}
```

**Test Case 2: Natural Language Intent Detection**
```
Input: "I need to search for the latest AI news"
Model Response: "I'll use web_search to find the latest AI news"
Expected: System detects intent and extracts tool call
```

**Test Case 3: Thinking Model Support**
```
Input: "What's the weather like today?"
Expected Output:
<think>
The user is asking about weather. I need to use web_search to find current weather information.
</think>

I'll search for current weather information.
```

#### Ollama Provider

**Test Case 1: Tool Call Detection**
```
Input: "Search for information about quantum computing"
Expected: System detects tool usage intent from model response
Validation: web_search tool is called with appropriate query
```

**Test Case 2: Error Handling**
```
Input: "Use an invalid tool name"
Expected: System provides user-friendly error message
Validation: Error is categorized and displayed properly
```

### 3. Error Handling Tests

#### Network Error Simulation
```
Test: Disconnect internet during tool execution
Expected: Network error message with retry suggestion
Validation: User sees "🌐 Network Error" message
```

#### Invalid Arguments Test
```
Test: Force tool call with empty arguments
Expected: Invalid arguments error with parameter guidance
Validation: User sees "📝 Invalid Arguments" message
```

#### Tool Not Found Test
```
Test: Call non-existent tool
Expected: Tool unavailable error with configuration hint
Validation: User sees "🔧 Tool Unavailable" message
```

#### Rate Limiting Test
```
Test: Exceed API rate limits
Expected: Rate limit error with wait suggestion
Validation: User sees "⏱️ Rate Limit" message
```

### 4. UI Component Tests

#### Tool Execution Display
```
Test: Execute successful tool call
Expected: Green status indicator and formatted results
Validation: Tool execution section shows success state
```

#### Error Display
```
Test: Execute failed tool call
Expected: Red status indicator and error details
Validation: Error message is user-friendly and actionable
```

#### Thinking Content Display
```
Test: Model with <think> tags
Expected: Collapsible thinking section with brain icon
Validation: Thinking content is separated from main response
```

#### Collapsible Sections
```
Test: Multiple tool calls and thinking content
Expected: All sections are collapsible and properly organized
Validation: UI remains clean and navigable
```

## Test Scenarios by Provider

### LM Studio Testing

1. **Model Setup**
   - Load a tool-calling capable model (e.g., Qwen, Gemma)
   - Verify model is responding to requests
   - Check tool calling is enabled in settings

2. **Basic Tool Calling**
   ```
   Test: "What's the weather in London?"
   Expected: Model uses web_search tool
   Validation: Weather information is returned
   ```

3. **Complex Queries**
   ```
   Test: "Compare the weather in London and Paris"
   Expected: Multiple tool calls or single search with comparison
   Validation: Information for both cities is provided
   ```

4. **Error Recovery**
   ```
   Test: "Search for [invalid query]"
   Expected: Error is handled gracefully
   Validation: User receives helpful error message
   ```

### Ollama Testing

1. **Model Compatibility**
   - Test with various Ollama models
   - Verify text-based tool detection works
   - Check thinking model support

2. **Tool Intent Detection**
   ```
   Test: "I need to find information about..."
   Expected: System detects search intent
   Validation: web_search tool is triggered
   ```

3. **Natural Language Processing**
   ```
   Test: "Can you look up the latest news?"
   Expected: Tool call extracted from natural language
   Validation: News search is performed
   ```

### OpenAI/Gemini/Mistral Testing

1. **Native Tool Calling**
   ```
   Test: Standard tool calling requests
   Expected: Native tool calls generated
   Validation: Tools execute through native API
   ```

2. **Parallel Execution**
   ```
   Test: Multiple tool requests
   Expected: Concurrent tool execution
   Validation: Performance improvement over sequential
   ```

## Performance Testing

### Concurrent Execution
```
Test: Execute 5 tools simultaneously
Measure: Total execution time vs sequential
Expected: Significant performance improvement
```

### Memory Usage
```
Test: Execute tools with large result sets
Measure: Memory consumption during execution
Expected: Stable memory usage without leaks
```

### Error Recovery Performance
```
Test: Mix of successful and failed tool calls
Measure: System responsiveness during errors
Expected: No system degradation from failures
```

## Automated Testing

### Unit Tests
```typescript
describe('Tool Calling System', () => {
  test('should detect native tool calls', () => {
    // Test native tool call detection
  });
  
  test('should parse text-based tool calls', () => {
    // Test text parsing logic
  });
  
  test('should handle tool execution errors', () => {
    // Test error handling
  });
});
```

### Integration Tests
```typescript
describe('Provider Integration', () => {
  test('LM Studio tool calling flow', () => {
    // Test complete LM Studio flow
  });
  
  test('Ollama tool calling flow', () => {
    // Test complete Ollama flow
  });
});
```

## Manual Testing Checklist

### Pre-Testing Setup
- [ ] MCP servers are running and connected
- [ ] API keys are configured correctly
- [ ] All providers are accessible
- [ ] Tool calling is enabled in settings

### Basic Functionality
- [ ] Single tool call execution
- [ ] Multiple tool call execution
- [ ] Tool call with complex arguments
- [ ] Error handling for failed tools
- [ ] UI displays tool execution correctly

### Provider-Specific Tests
- [ ] LM Studio native and text-based calling
- [ ] Ollama text-based calling
- [ ] OpenAI native calling
- [ ] Gemini native calling
- [ ] Mistral native calling

### Edge Cases
- [ ] Empty tool arguments
- [ ] Invalid tool names
- [ ] Network connectivity issues
- [ ] API rate limiting
- [ ] Large result sets
- [ ] Concurrent tool execution

### UI/UX Testing
- [ ] Tool execution indicators work
- [ ] Error messages are clear
- [ ] Collapsible sections function
- [ ] Thinking content is displayed
- [ ] Performance is acceptable

## Regression Testing

### After Code Changes
1. Run full test suite
2. Test all providers manually
3. Verify error handling still works
4. Check UI components display correctly
5. Validate performance hasn't degraded

### Before Releases
1. Complete manual testing checklist
2. Test with real-world scenarios
3. Verify documentation is up-to-date
4. Check all error messages are user-friendly
5. Validate tool calling works across all supported models

## Troubleshooting Test Failures

### Tool Not Executing
1. Check MCP server status
2. Verify tool is available
3. Check network connectivity
4. Validate API credentials

### Incorrect Tool Detection
1. Review model output format
2. Check parsing logic
3. Verify tool name matching
4. Test with different models

### UI Display Issues
1. Check component props
2. Verify data formatting
3. Test responsive design
4. Validate accessibility

### Performance Problems
1. Profile tool execution
2. Check for memory leaks
3. Analyze network requests
4. Optimize concurrent execution
