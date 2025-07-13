# Provider API Testing with curl

This document contains curl tests to verify the correct API behavior for each LLM provider, specifically focusing on tool calling functionality.

## LM Studio API Testing

**Base URL**: `http://localhost:1234`
**Available Models**: mistralai/mistral-small-3.2, qwen/qwen3-30b-a3b, google/gemma-3-12b, etc.

### 1. Basic Chat Request (No Tools)

```bash
curl -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistralai/mistral-small-3.2",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

### 2. Chat Request with Tools

```bash
curl -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistralai/mistral-small-3.2",
    "messages": [
      {"role": "user", "content": "What is the weather like in San Francisco, CA today?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto",
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

### 3. Follow-up Request with Tool Results

```bash
curl -X POST http://192.168.100.5:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cogito:30bthinking",
    "messages": [
      {"role": "user", "content": "What is the weather like today?"},
      {
        "role": "assistant",
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"San Francisco, CA\"}"
            }
          }
        ]
      },
      {
        "role": "tool",
        "tool_call_id": "call_123",
        "content": "{\"temperature\": \"72°F\", \"condition\": \"sunny\", \"humidity\": \"45%\"}"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

## Expected Response Formats

### Basic Response (No Tools)
```json
{
  "id": "chatcmpl-tejkg5dpa3mnemi1sf2uyr",
  "object": "chat.completion",
  "created": 1752289540,
  "model": "mistralai/mistral-small-3.2",
  "choices": [
    {
      "index": 0,
      "logprobs": null,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "Hello! I'm an AI, so I don't have feelings, but I'm here and ready to help you with anything you need. How can I assist you today?",
        "reasoning_content": ""
      }
    }
  ],
  "usage": {
    "prompt_tokens": 328,
    "completion_tokens": 35,
    "total_tokens": 363
  },
  "stats": {},
  "system_fingerprint": "mistralai/mistral-small-3.2"
}
```

### Tool Call Response
```json
{
  "id": "chatcmpl-f131ji0rks58sx8n7u1jj4",
  "object": "chat.completion",
  "created": 1752289566,
  "model": "mistralai/mistral-small-3.2",
  "choices": [
    {
      "index": 0,
      "logprobs": null,
      "finish_reason": "tool_calls",
      "message": {
        "role": "assistant",
        "tool_calls": [
          {
            "id": "999379945",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"San Francisco, CA\"}"
            }
          }
        ],
        "reasoning_content": ""
      }
    }
  ],
  "usage": {
    "prompt_tokens": 369,
    "completion_tokens": 32,
    "total_tokens": 401
  },
  "stats": {},
  "system_fingerprint": "mistralai/mistral-small-3.2"
}
```

### Final Response (After Tool Execution)
```json
{
  "id": "chatcmpl-1dj95vf8weadclaa830rs",
  "object": "chat.completion",
  "created": 1752289578,
  "model": "mistralai/mistral-small-3.2",
  "choices": [
    {
      "index": 0,
      "logprobs": null,
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": "The weather in San Francisco today is sunny with a temperature of 72°F and a humidity level of 45%.",
        "reasoning_content": ""
      }
    }
  ],
  "usage": {
    "prompt_tokens": 334,
    "completion_tokens": 26,
    "total_tokens": 360
  },
  "stats": {},
  "system_fingerprint": "mistralai/mistral-small-3.2"
}
```

## Test Results

### Test 1: Basic Chat (No Tools)
- **Status**: ✅ SUCCESS
- **Response**: Standard OpenAI-compatible format with `reasoning_content` field
- **Notes**: LM Studio uses localhost:1234, returns proper usage stats

### Test 2: Chat with Tools
- **Status**: ✅ SUCCESS
- **Response**: Returns `tool_calls` array with proper structure
- **Notes**: Model correctly identifies need for tool and formats call properly

### Test 3: Follow-up with Tool Results
- **Status**: ✅ SUCCESS
- **Response**: Processes tool results and provides natural language response
- **Notes**: Two-call pattern works perfectly

## Key Findings

1. **Tool Format**: Standard OpenAI format with `tools` array and `tool_choice`
2. **Response Structure**: OpenAI-compatible with additional `reasoning_content` field
3. **Error Handling**: Proper error messages for invalid models
4. **Two-Call Pattern**: ✅ CONFIRMED - Works exactly as expected

## Next Steps

Based on these test results, update the LM Studio implementation in `llmService.ts` to match the actual API behavior.

---

## Ollama API Testing

**Base URL**: `http://192.168.100.5:11434`
**Available Models**: cogito:30bthinking, etc.

### 1. Basic Chat Request (No Tools)

```bash
curl -X POST http://192.168.100.5:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cogito:30bthinking",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

### 2. Chat Request with Tools

```bash
curl -X POST http://192.168.100.5:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cogito:30bthinking",
    "messages": [
      {"role": "user", "content": "What is the weather like in San Francisco, CA today?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto",
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

### 3. Follow-up Request with Tool Results

```bash
curl -X POST http://192.168.100.5:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cogito:30bthinking",
    "messages": [
      {"role": "user", "content": "What is the weather like in San Francisco, CA today?"},
      {
        "role": "assistant",
        "tool_calls": [
          {
            "id": "call_mdiu92oz",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"San Francisco, CA\"}"
            }
          }
        ]
      },
      {
        "role": "tool",
        "tool_call_id": "call_mdiu92oz",
        "content": "{\"temperature\": \"72°F\", \"condition\": \"sunny\", \"humidity\": \"45%\"}"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

## Ollama Test Results

### Test 1: Basic Chat (No Tools)
- **Status**: ✅ SUCCESS
- **Response**: Standard OpenAI-compatible format with `system_fingerprint: fp_ollama`
- **Notes**: Ollama uses port 11434, includes thinking process in content

### Test 2: Chat with Tools
- **Status**: ✅ SUCCESS
- **Response**: Returns `tool_calls` array with proper structure
- **Notes**: Model correctly identifies need for tool and formats call properly

### Test 3: Follow-up with Tool Results
- **Status**: ✅ SUCCESS
- **Response**: Processes tool results and provides natural language response
- **Notes**: Two-call pattern works perfectly, includes thinking process

## Ollama Key Findings

1. **Tool Format**: Standard OpenAI format with `tools` array and `tool_choice`
2. **Response Structure**: OpenAI-compatible with `system_fingerprint: fp_ollama`
3. **Error Handling**: Standard HTTP error responses
4. **Two-Call Pattern**: ✅ CONFIRMED - Works exactly as expected
5. **Special Feature**: Includes `<think>` tags in content showing reasoning process

---

## Mistral API Testing

**Base URL**: `https://api.mistral.ai`
**API Key**: Required (from environment/settings)

### 1. Basic Chat Request (No Tools)

```bash
curl -X POST https://api.mistral.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -d '{
    "model": "mistral-small-latest",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

### 2. Chat Request with Tools

```bash
curl -X POST https://api.mistral.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -d '{
    "model": "mistral-small-latest",
    "messages": [
      {"role": "user", "content": "What is the weather like in San Francisco, CA today?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto",
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

### 3. Follow-up Request with Tool Results

```bash
curl -X POST https://api.mistral.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -d '{
    "model": "mistral-small-latest",
    "messages": [
      {"role": "user", "content": "What is the weather like in San Francisco, CA today?"},
      {
        "role": "assistant",
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"San Francisco, CA\"}"
            }
          }
        ]
      },
      {
        "role": "tool",
        "name": "get_weather",
        "content": "{\"temperature\": \"72°F\", \"condition\": \"sunny\", \"humidity\": \"45%\"}",
        "tool_call_id": "call_abc123"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 200
  }'
```

## Mistral Test Results

### Test 1: Basic Chat (No Tools)
- **Status**: ✅ SUCCESS
- **Response**: Standard OpenAI-compatible format with proper usage stats
- **Notes**: Returns clean response with emoji support

### Test 2: Chat with Tools
- **Status**: ✅ SUCCESS
- **Response**: Returns `tool_calls` array with proper structure
- **Notes**: Model correctly identifies need for tool and formats call properly

### Test 3: Follow-up with Tool Results
- **Status**: ✅ SUCCESS
- **Response**: Processes tool results and provides natural language response
- **Notes**: Two-call pattern works perfectly

## Mistral Key Findings

1. **Tool Format**: Standard OpenAI format with `tools` array and `tool_choice`
2. **Response Structure**: OpenAI-compatible format
3. **Authentication**: Requires `Authorization: Bearer <api_key>` header
4. **Two-Call Pattern**: ✅ CONFIRMED - Implementation follows OpenAI standard
5. **Tool Results Format**: Uses `role: tool` with `name` and `tool_call_id` fields

---

## Requesty API Testing (UPDATED)

**Base URL**: `https://router.requesty.ai/v1`
**API Key**: Required (from environment/settings)
**Key Finding**: Must use models that support tool calling (e.g., `openai/gpt-4o-mini`)

### Test Results

### Test 1: Basic Chat (No Tools)
- **Status**: ✅ SUCCESS
- **Response**: Standard OpenAI-compatible format with Requesty-specific fields
- **Notes**: Returns `base_resp` status and detailed usage stats

### Test 2: Chat with Tools (Correct Model)
- **Status**: ✅ SUCCESS
- **Response**: Returns `tool_calls` array with proper structure
- **Notes**: Model `openai/gpt-4o-mini` correctly identifies and calls tools

### Test 3: Follow-up with Tool Results
- **Status**: ✅ SUCCESS
- **Response**: Processes tool results and provides natural language response
- **Notes**: Two-call pattern works perfectly

## Requesty Key Findings

1. **Tool Format**: Standard OpenAI format with `tools` array and `tool_choice`
2. **Response Structure**: OpenAI-compatible with additional Requesty fields (`base_resp`)
3. **Authentication**: Requires `Authorization: Bearer <api_key>` header
4. **Two-Call Pattern**: ✅ CONFIRMED - Works with tool-capable models
5. **Model Selection**: CRITICAL - Must use models that support tool calling
6. **Available Tool Models**: `openai/gpt-4o-mini`, `openai/gpt-4o`, `anthropic/claude-*`, etc.
