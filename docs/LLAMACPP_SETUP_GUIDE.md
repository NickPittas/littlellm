# Llama.cpp Setup Guide for LittleLLM

This guide walks you through setting up llama.cpp integration in LittleLLM from scratch.

## Step-by-Step Setup

### Step 1: Verify Installation

1. **Check LittleLLM Version**
   - Ensure you're using the latest version with llama.cpp support
   - Look for the "LLAMA.CPP" button in the left sidebar

2. **Verify Executables**
   - Check that `llama/llama-server.exe` exists
   - Check that `llama/llama-swap.exe` exists
   - These should be included with LittleLLM

### Step 2: Create Models Directory

1. **Create Directory Structure**
   ```
   LittleLLM/
   ├── models/          # Create this directory
   ├── llama/
   │   ├── llama-server.exe
   │   └── llama-swap.exe
   └── ...
   ```

2. **Set Permissions**
   - Ensure the models directory is writable
   - Verify llama executables have execute permissions

### Step 3: Download Your First Model

#### Option A: Recommended Starter Model (Phi-3 Mini)

1. **Visit Hugging Face**
   - Go to: https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf
   - Browse the available files

2. **Download Q4_K_M Version**
   - Look for: `Phi-3-mini-4k-instruct-q4.gguf`
   - Size: ~2.3GB
   - Click to download

3. **Place in Models Directory**
   - Move the downloaded file to `LittleLLM/models/`
   - Rename if needed for clarity

#### Option B: Ultra-Light Model (Qwen2.5 0.5B)

1. **Visit Repository**
   - Go to: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF

2. **Download Small Version**
   - Look for: `qwen2.5-0.5b-instruct-q4_k_m.gguf`
   - Size: ~350MB

3. **Place in Models Directory**
   - Move to `LittleLLM/models/`

### Step 4: Configure LittleLLM

1. **Open LittleLLM**
   - Start the application
   - Wait for full initialization

2. **Access Llama.cpp Panel**
   - Click "LLAMA.CPP" in the left sidebar
   - The management panel should open

3. **Verify Model Detection**
   - Your downloaded model should appear in the list
   - If not, restart LittleLLM

### Step 5: Start llama-swap

1. **Check Status**
   - Look for "Llama-swap: Stopped" in the status bar

2. **Start Service**
   - Click the "Start" button
   - Wait for status to change to "Running"
   - This may take 10-30 seconds

3. **Verify Connection**
   - Status should show green indicator
   - Port 8080 should be in use

### Step 6: Select Provider and Model

1. **Open Provider Dropdown**
   - In the main chat interface
   - Click the provider selection dropdown

2. **Choose Local Providers**
   - Select "Local Providers" from the dropdown
   - This filters to show only local options

3. **Select Llama.cpp**
   - Choose "Llama.cpp" from the provider list
   - The model dropdown should populate

4. **Choose Your Model**
   - Select your downloaded model
   - Wait for the selection to register

### Step 7: Test the Integration

1. **Send Test Message**
   ```
   Hello! Can you tell me about yourself?
   ```

2. **Verify Response**
   - Should see streaming response
   - Response should be from your local model
   - No external API calls made

3. **Test Tool Calling**
   ```
   What's the current time?
   ```
   - Should trigger tool execution
   - Verify tools work with local model

## Configuration Optimization

### For 8GB RAM Systems

**Recommended Settings:**
- Model: Qwen2.5 0.5B or Phi-3 Mini
- Context Size: 2048-4096
- GPU Layers: 0 (CPU only)
- Batch Size: 256

### For 16GB+ RAM Systems

**Recommended Settings:**
- Model: Phi-3 Mini or Llama 3.2 3B
- Context Size: 4096-8192
- GPU Layers: 0-20 (depending on GPU)
- Batch Size: 512-1024

### For GPU Systems

**Additional Settings:**
- GPU Layers: 20-35 (adjust based on VRAM)
- Higher batch sizes for better throughput
- Larger context sizes for longer conversations

## Troubleshooting Setup Issues

### Issue: "No models found"

**Solutions:**
1. Check models directory exists
2. Verify .gguf files are present
3. Restart LittleLLM
4. Check file permissions

### Issue: "llama-swap won't start"

**Solutions:**
1. Check if port 8080 is available
2. Close other applications using the port
3. Run LittleLLM as administrator (Windows)
4. Check antivirus isn't blocking executables

### Issue: "Model loading failed"

**Solutions:**
1. Verify sufficient RAM
2. Try smaller model or quantization
3. Reduce context size
4. Check model file integrity

### Issue: "Slow responses"

**Solutions:**
1. Reduce context size
2. Use Q4_K_M quantization
3. Enable GPU acceleration
4. Increase CPU threads

## Advanced Setup

### Multiple Models

1. **Download Multiple Models**
   - Place all .gguf files in models directory
   - Each will appear in the model list

2. **Model Switching**
   - Change models via dropdown
   - llama-swap handles switching automatically
   - No restart required

### Custom Models

1. **Find GGUF Models**
   - Search Hugging Face for "gguf"
   - Look for models with good ratings
   - Check compatibility notes

2. **Download and Install**
   - Follow same process as above
   - Place in models directory
   - Configure parameters appropriately

### Performance Tuning

1. **Monitor Resource Usage**
   - Watch RAM consumption
   - Monitor CPU usage
   - Check GPU utilization (if applicable)

2. **Adjust Parameters**
   - Start with defaults
   - Gradually optimize for your system
   - Test different configurations

## Next Steps

After successful setup:

1. **Explore Features**
   - Try different models
   - Test tool calling capabilities
   - Experiment with parameters

2. **Optimize Performance**
   - Fine-tune settings for your hardware
   - Test different quantization levels
   - Monitor resource usage

3. **Advanced Usage**
   - Integrate with knowledge base
   - Use with MCP servers
   - Explore custom prompts

## Getting Help

If you encounter issues:

1. **Check Documentation**
   - Review LLAMACPP_INTEGRATION.md
   - Check troubleshooting sections

2. **Community Support**
   - LittleLLM Discord
   - GitHub Issues
   - Community forums

3. **Debug Information**
   - Check console logs
   - Monitor system resources
   - Test with minimal configurations

---

*Congratulations! You now have a fully functional local AI setup with LittleLLM and llama.cpp.*
