# Llama.cpp Integration for LittleLLM

This document provides comprehensive information about the llama.cpp integration in LittleLLM, enabling you to run local AI models with full feature parity to cloud providers.

## Overview

The llama.cpp integration allows LittleLLM to operate completely independently using local GGUF models through the llama.cpp inference engine and llama-swap proxy server. This provides:

- **Complete Privacy**: All inference happens locally
- **No API Costs**: No charges for model usage
- **Full Control**: Customize parameters and models
- **Offline Operation**: Works without internet connection
- **High Performance**: Optimized inference with GPU acceleration

## Architecture

```
LittleLLM UI → LlamaCppProvider → llama-swap proxy → llama-server → GGUF Models
```

### Components

1. **LlamaCppProvider**: OpenAI-compatible provider implementation
2. **llama-swap**: Proxy server for model switching and management
3. **llama-server**: Core inference engine from llama.cpp
4. **LlamaCppPanel**: UI for model management and configuration
5. **llamaCppService**: Browser service for Electron IPC communication

## Prerequisites

### System Requirements

- **RAM**: Minimum 8GB (16GB+ recommended)
- **Storage**: 2GB+ free space for models
- **CPU**: Modern multi-core processor
- **GPU** (Optional): NVIDIA GPU with CUDA support for acceleration

### Included Executables

The integration includes pre-built llama.cpp executables:
- `llama/llama-server.exe` - Core inference server
- `llama/llama-swap.exe` - Model switching proxy

## Quick Start

### 1. Access Llama.cpp Management

1. Open LittleLLM
2. Click the **LLAMA.CPP** button in the left sidebar
3. The Llama.cpp Management panel will open

### 2. Download Models

1. In the management panel, click **Add Model**
2. Select a model from the catalog:
   - **Phi-3 Mini 4K**: Small, efficient model (2.3GB)
   - **Qwen2.5 0.5B**: Ultra-compact model (350MB)
   - **Llama 3.2 3B**: Balanced performance model (1.9GB)
3. Choose quantization level (Q4_K_M recommended)
4. Click **Download** (Note: Currently shows placeholder - manual download required)

### 3. Manual Model Installation

Until automatic downloading is implemented:

1. Download GGUF models from Hugging Face:
   - Visit the model repository (e.g., `microsoft/Phi-3-mini-4k-instruct-gguf`)
   - Download the desired quantization (e.g., `Phi-3-mini-4k-instruct-q4.gguf`)
2. Place the `.gguf` file in the `models/` directory
3. Restart LittleLLM or refresh the model list

### 4. Start llama-swap

1. In the management panel, click **Start** next to the llama-swap status
2. Wait for the green "Running" indicator
3. The proxy will be available at `http://127.0.0.1:8080`

### 5. Select Llama.cpp Provider

1. In the main chat interface, click the provider dropdown
2. Select **Local Providers**
3. Choose **Llama.cpp**
4. Select your downloaded model from the model dropdown

### 6. Start Chatting

You can now chat with your local llama.cpp model with full LittleLLM features:
- Tool calling and MCP integration
- Streaming responses
- Knowledge base search
- Memory integration

## Model Configuration

### Parameter Tuning

Click the settings icon next to any model to configure:

#### Core Parameters
- **Context Size**: Token limit (512-32768)
- **CPU Threads**: Processing threads (-1 for auto)
- **GPU Layers**: Layers offloaded to GPU (0 for CPU-only)

#### Generation Parameters
- **Temperature**: Randomness (0.1-2.0, lower = more focused)
- **Top K**: Vocabulary limiting (1-100)
- **Top P**: Nucleus sampling (0.1-1.0)
- **Repeat Penalty**: Repetition reduction (1.0-2.0)

#### Performance Parameters
- **Batch Size**: Parallel token processing (1-2048)

### Recommended Settings

#### For CPU-Only Systems
```
Context Size: 4096
CPU Threads: -1 (auto)
GPU Layers: 0
Temperature: 0.7
Batch Size: 512
```

#### For GPU-Accelerated Systems
```
Context Size: 8192
CPU Threads: 4
GPU Layers: 20-35 (adjust based on VRAM)
Temperature: 0.7
Batch Size: 1024
```

## Model Catalog

### Recommended Models

#### Phi-3 Mini 4K Instruct
- **Size**: 2.3GB (Q4_K_M)
- **Parameters**: 3.8B
- **Best For**: General tasks, coding assistance
- **RAM Required**: 4GB+

#### Qwen2.5 0.5B Instruct
- **Size**: 350MB (Q4_K_M)
- **Parameters**: 0.5B
- **Best For**: Basic tasks, resource-constrained systems
- **RAM Required**: 2GB+

#### Llama 3.2 3B Instruct
- **Size**: 1.9GB (Q4_K_M)
- **Parameters**: 3B
- **Best For**: Reasoning, analysis tasks
- **RAM Required**: 4GB+

### Quantization Levels

- **Q4_K_M**: Best balance of quality and size (Recommended)
- **Q5_K_M**: Higher quality, larger size
- **Q8_0**: Near-original quality, much larger
- **F16**: Full precision, largest size

## Troubleshooting

### Common Issues

#### "llama-swap failed to start"
1. Check if port 8080 is available
2. Ensure llama executables have proper permissions
3. Verify models directory exists and contains .gguf files

#### "No models found"
1. Place .gguf files in the `models/` directory
2. Restart LittleLLM
3. Check file permissions

#### "Model loading failed"
1. Verify sufficient RAM for the model
2. Check model file integrity
3. Try reducing context size or GPU layers

#### Poor Performance
1. Increase GPU layers if you have a GPU
2. Adjust CPU threads (try 4-8 for most systems)
3. Reduce context size for faster responses
4. Use smaller quantization (Q4_K_M instead of Q8_0)

### Performance Optimization

#### For Maximum Speed
- Use Q4_K_M quantization
- Set context size to 2048-4096
- Enable GPU acceleration
- Use smaller models (0.5B-3B parameters)

#### For Maximum Quality
- Use Q8_0 or F16 quantization
- Increase context size to 8192+
- Use larger models (7B+ parameters)
- Fine-tune temperature and sampling parameters

## Advanced Configuration

### Custom Model Integration

1. Download any GGUF model from Hugging Face
2. Place in `models/` directory
3. Restart LittleLLM
4. Configure parameters based on model size and capabilities

### llama-swap Configuration

The system automatically generates `llama-swap-config.yaml` with:
- Model definitions and commands
- Port assignments
- Health check timeouts
- Proxy configurations

### Environment Variables

Set these for advanced configuration:
- `LLAMA_CPP_PORT`: Default port for llama-server (default: 8080)
- `LLAMA_CPP_HOST`: Host binding (default: 127.0.0.1)
- `LLAMA_CPP_THREADS`: Default thread count

## Integration Features

### Tool Calling
Llama.cpp models support text-based tool calling with all MCP servers:
- Web search
- File operations
- Memory management
- Sequential thinking
- Custom tools

### Streaming
Real-time response streaming with:
- Token-by-token display
- Thinking process visualization
- Tool execution progress

### Knowledge Base
Full integration with LittleLLM's knowledge base:
- Document search and retrieval
- Context injection
- Source attribution

## Security Considerations

- All inference happens locally
- No data sent to external servers
- Model files stored locally
- Network access only for model downloads

## Support and Resources

### Documentation
- [llama.cpp GitHub](https://github.com/ggml-org/llama.cpp)
- [llama-swap GitHub](https://github.com/mostlygeek/llama-swap)
- [Hugging Face GGUF Models](https://huggingface.co/models?library=gguf)

### Community
- LittleLLM Discord
- llama.cpp Discussions
- Model recommendations and benchmarks

---

*This integration provides a complete local AI solution within LittleLLM, offering privacy, control, and performance for all your AI needs.*
