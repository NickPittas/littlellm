# Jan AI Integration Guide

## Overview

Jan AI has been successfully integrated as a new local provider in LittleLLM. This integration allows users to run AI models locally through Jan AI's desktop application while maintaining full privacy and control over their data.

## What is Jan AI?

Jan AI is an open-source alternative to ChatGPT that runs entirely on your computer. It provides:

- **Complete Privacy**: All processing happens locally on your device
- **OpenAI-Compatible API**: Uses standard OpenAI API format for easy integration
- **Model Flexibility**: Supports various open-source models
- **No Internet Required**: Works completely offline once models are downloaded

## Prerequisites

1. **Install Jan AI**: Download and install Jan AI from [https://jan.ai](https://jan.ai)
2. **Start API Server**: Launch Jan AI and enable the API server
3. **Load a Model**: Download and load at least one model in Jan AI

## Configuration in LittleLLM

### 1. Provider Settings

Jan AI appears as a local provider in LittleLLM alongside Ollama and LM Studio:

- **Provider Name**: Jan AI
- **Default Port**: 1337
- **API Format**: OpenAI-compatible
- **Base URL**: `http://127.0.0.1:1337/v1`
- **Authentication**: Requires API key (mandatory)

### 2. API Key Configuration

1. Open LittleLLM Settings
2. Navigate to "API Keys" tab
3. Find "Jan AI" in the provider list
4. Enter your Jan AI API key (if required)
5. Set the Base URL to `http://localhost:1337/v1` (or your custom Jan AI server URL)

### 3. Model Selection

Once configured, you can:

1. Select "Local Providers" in the provider dropdown
2. Choose "Jan AI" from the list
3. Select from available models loaded in Jan AI
4. Start chatting with complete privacy

## Features Supported

### ✅ Fully Supported
- **Chat Completion**: Standard text-based conversations
- **Streaming Responses**: Real-time response streaming
- **Tool Calling**: MCP tool integration (if supported by the model)
- **Vision Support**: Image analysis (model-dependent)
- **System Messages**: Custom system prompts
- **Temperature Control**: Response creativity adjustment
- **Token Limits**: Maximum response length control

### 🔧 Model-Dependent
- **Tool Calling**: Depends on the specific model's capabilities
- **Vision Support**: Only available with vision-enabled models
- **Context Length**: Varies by model

## API Endpoints

Jan AI uses OpenAI-compatible endpoints:

- **Models**: `GET /v1/models`
- **Chat Completions**: `POST /v1/chat/completions`
- **Streaming**: Supported via `stream: true` parameter

## Troubleshooting

### Common Issues

1. **"Failed to connect to Jan AI"**
   - Ensure Jan AI is running
   - Verify the API server is enabled in Jan AI settings (Settings > Local API Server > Start Server)
   - Check the base URL is correct (`http://127.0.0.1:1337/v1`)
   - Verify the API key is set in both Jan AI and LittleLLM settings

2. **"No models found"**
   - Download and load at least one model in Jan AI
   - Refresh the model list in LittleLLM
   - Verify the model is properly loaded in Jan AI

3. **Tool calling not working**
   - Ensure the loaded model supports function calling
   - Check that tool calling is enabled in LittleLLM settings
   - Some models may not support structured tool calling

### Port Conflicts

If port 1337 is in use:

1. Change Jan AI's API port in its settings
2. Update the Base URL in LittleLLM accordingly
3. Example: If Jan AI uses port 1338, set Base URL to `http://localhost:1338/v1`

## Performance Tips

1. **Model Selection**: Choose models appropriate for your hardware
2. **Context Management**: Longer conversations use more memory
3. **Streaming**: Enable streaming for better perceived performance
4. **Local Processing**: No internet required once models are downloaded

## Privacy Benefits

- **Complete Local Processing**: All data stays on your device
- **No External API Calls**: No data sent to external servers
- **Offline Capability**: Works without internet connection
- **Full Control**: You control the models and data processing

## Integration Details

### Provider Implementation

Jan AI is implemented as a local provider following the same patterns as Ollama and LM Studio:

- **Provider Class**: `JanProvider.ts`
- **System Prompt**: Optimized for local inference
- **Tool Integration**: OpenAI-compatible tool calling format
- **Error Handling**: Comprehensive error messages and fallbacks

### UI Integration

- Appears in "Local Providers" section
- Consistent with other local provider interfaces
- Supports all standard LittleLLM features
- Seamless switching between providers

## Getting Started

1. **Install Jan AI** from [https://jan.ai](https://jan.ai)
2. **Download a model** (e.g., Llama 2, Mistral, etc.)
3. **Enable API server** in Jan AI settings
4. **Configure LittleLLM** with Jan AI settings
5. **Start chatting** with complete privacy!

## Support

For Jan AI-specific issues:
- Visit [Jan AI Documentation](https://jan.ai/docs)
- Check [Jan AI GitHub](https://github.com/janhq/jan)
- Join the Jan AI community

For LittleLLM integration issues:
- Check the LittleLLM logs for error details
- Verify Jan AI is running and accessible
- Ensure proper configuration in settings
