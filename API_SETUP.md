# API Key Setup Guide

This guide will help you obtain and configure API keys for all supported providers in LittleLLM v1.5.

## 🔑 Supported Providers

- [OpenAI](#openai) - GPT-4, GPT-4o, GPT-3.5-turbo
- [Anthropic](#anthropic) - Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- [Google Gemini](#google-gemini) - Gemini Pro, Gemini Flash
- [Mistral AI](#mistral-ai) - Mistral Large, Mistral Medium, Mistral Small
- [DeepSeek](#deepseek) - DeepSeek Chat, DeepSeek Coder
- [LM Studio](#lm-studio) - Local server for any GGUF model (free)
- [Ollama](#ollama) - Local AI models (free)
- [OpenRouter](#openrouter) - 100+ models from various providers
- [Replicate](#replicate) - Cloud-hosted AI models
- [Requesty](#requesty) - Custom API endpoints

---

## OpenAI

### Getting Your API Key

1. **Visit OpenAI Platform**
   - Go to [platform.openai.com](https://platform.openai.com)
   - Sign in or create an account

2. **Navigate to API Keys**
   - Click on your profile (top right)
   - Select "View API keys" or go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

3. **Create New Key**
   - Click "Create new secret key"
   - Give it a descriptive name (e.g., "LittleLLM Desktop")
   - Copy the key immediately (you won't see it again)

4. **Add Billing Information**
   - Go to [platform.openai.com/account/billing](https://platform.openai.com/account/billing)
   - Add a payment method
   - Set usage limits if desired

### Configuration in LittleLLM
1. Open LittleLLM Settings (gear icon)
2. Go to "Providers" tab
3. Find "OpenAI" section
4. Paste your API key
5. Click "Save Settings"

### Available Models
- `gpt-4o` - Latest GPT-4 with vision
- `gpt-4o-mini` - Faster, cheaper GPT-4
- `gpt-4-turbo` - Previous generation GPT-4
- `gpt-3.5-turbo` - Fast and economical

### Pricing (as of 2024)
- GPT-4o: $5/1M input tokens, $15/1M output tokens
- GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
- GPT-3.5-turbo: $0.50/1M input tokens, $1.50/1M output tokens

---

## Anthropic

### Getting Your API Key

1. **Visit Anthropic Console**
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Sign up or sign in

2. **Create API Key**
   - Navigate to "API Keys" in the dashboard
   - Click "Create Key"
   - Give it a name (e.g., "LittleLLM Desktop")
   - Copy the key (starts with `sk-ant-`)

3. **Add Credits**
   - Go to "Billing" section
   - Add payment method
   - Purchase credits or set up auto-reload

### Configuration in LittleLLM
1. Open LittleLLM Settings (gear icon)
2. Go to "Providers" tab
3. Find "Anthropic" section
4. Paste your API key
5. Click "Save Settings"

### Available Models
- `claude-3-5-sonnet-20241022` - Latest and most capable
- `claude-3-opus-20240229` - Most powerful for complex tasks
- `claude-3-sonnet-20240229` - Balanced performance and speed
- `claude-3-haiku-20240307` - Fastest and most economical

### Pricing (as of 2024)
- Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3 Opus: $15/1M input tokens, $75/1M output tokens
- Claude 3 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3 Haiku: $0.25/1M input tokens, $1.25/1M output tokens

---

## Google Gemini

### Getting Your API Key

1. **Visit Google AI Studio**
   - Go to [aistudio.google.com](https://aistudio.google.com)
   - Sign in with your Google account

2. **Create API Key**
   - Click "Get API key" in the top menu
   - Click "Create API key"
   - Select a Google Cloud project or create new one
   - Copy the generated API key

3. **Enable Billing (for higher quotas)**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Enable billing for your project
   - Enable the Generative AI API

### Configuration in LittleLLM
1. Open LittleLLM Settings (gear icon)
2. Go to "Providers" tab
3. Find "Google Gemini" section
4. Paste your API key
5. Click "Save Settings"

### Available Models
- `gemini-1.5-pro` - Most capable multimodal model
- `gemini-1.5-flash` - Faster, more efficient version
- `gemini-1.0-pro` - Previous generation

### Pricing (as of 2024)
- Gemini 1.5 Pro: $3.50/1M input tokens, $10.50/1M output tokens
- Gemini 1.5 Flash: $0.075/1M input tokens, $0.30/1M output tokens
- Free tier: 15 requests per minute, 1500 requests per day

---

## Mistral AI

### Getting Your API Key

1. **Visit Mistral Console**
   - Go to [console.mistral.ai](https://console.mistral.ai)
   - Sign up or sign in

2. **Create API Key**
   - Go to "API Keys" section
   - Click "Create new key"
   - Name it (e.g., "LittleLLM")
   - Copy the generated key

3. **Add Payment Method**
   - Go to "Billing" section
   - Add credit card for pay-as-you-go

### Configuration in LittleLLM
1. Open LittleLLM Settings (gear icon)
2. Go to "Providers" tab
3. Find "Mistral AI" section
4. Paste your API key
5. Click "Save Settings"

### Available Models
- `mistral-large-latest` - Most capable model
- `mistral-medium-latest` - Balanced performance
- `mistral-small-latest` - Fast and economical
- `codestral-latest` - Specialized for coding

### Pricing (as of 2024)
- Mistral Large: $4/1M input tokens, $12/1M output tokens
- Mistral Medium: $2.70/1M input tokens, $8.10/1M output tokens
- Mistral Small: $1/1M input tokens, $3/1M output tokens

---

## DeepSeek

### Getting Your API Key

1. **Visit DeepSeek Platform**
   - Go to [platform.deepseek.com](https://platform.deepseek.com)
   - Sign up or sign in

2. **Create API Key**
   - Navigate to "API Keys"
   - Click "Create API Key"
   - Name it (e.g., "LittleLLM")
   - Copy the key (starts with `sk-`)

3. **Add Credits**
   - Go to "Usage" section
   - Add credits via payment method

### Configuration in LittleLLM
1. Open LittleLLM Settings (gear icon)
2. Go to "Providers" tab
3. Find "DeepSeek" section
4. Paste your API key
5. Click "Save Settings"

### Available Models
- `deepseek-chat` - General conversation model
- `deepseek-coder` - Specialized for programming

### Pricing (as of 2024)
- DeepSeek Chat: $0.14/1M input tokens, $0.28/1M output tokens
- DeepSeek Coder: $0.14/1M input tokens, $0.28/1M output tokens

---

## LM Studio

### Setup Instructions

1. **Download LM Studio**
   - Go to [lmstudio.ai](https://lmstudio.ai)
   - Download for your operating system
   - Install and launch

2. **Download a Model**
   - Browse the model library
   - Search for models (e.g., "llama", "mistral", "phi")
   - Download a model (GGUF format)
   - Recommended: Llama 3.1 8B, Mistral 7B, or Phi-3 Mini

3. **Start Local Server**
   - Go to "Local Server" tab in LM Studio
   - Select your downloaded model
   - Click "Start Server"
   - Server runs on `http://localhost:1234`

### Configuration in LittleLLM
1. **Ensure LM Studio server is running**
2. Open LittleLLM Settings (gear icon)
3. Go to "Providers" tab
4. Find "LM Studio" section
5. Verify Base URL is `http://localhost:1234/v1`
6. No API key required
7. Click "Save Settings"

### Benefits
- **Completely free** - No API costs
- **Privacy** - Everything runs locally
- **Offline capable** - No internet required
- **Fast** - Direct local access
- **Any model** - Support for thousands of GGUF models

### Requirements
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 4-20GB per model
- **CPU**: Modern processor (Apple Silicon or x64)

---

## OpenRouter

### Getting Your API Key

1. **Visit OpenRouter**
   - Go to [openrouter.ai](https://openrouter.ai)
   - Sign up with Google, GitHub, or email

2. **Get API Key**
   - Go to [openrouter.ai/keys](https://openrouter.ai/keys)
   - Click "Create Key"
   - Name it (e.g., "LittleLLM")
   - Copy the key

3. **Add Credits**
   - Go to [openrouter.ai/credits](https://openrouter.ai/credits)
   - Add credits via credit card or crypto
   - Minimum $5 recommended

### Configuration in LittleLLM
1. Open LittleLLM Settings
2. Go to "Providers" tab
3. Find "OpenRouter" section
4. Paste your API key
5. Click "Save Settings"

### Popular Models
- `anthropic/claude-3.5-sonnet` - Excellent reasoning
- `meta-llama/llama-3.1-405b-instruct` - Large open model
- `google/gemini-pro-1.5` - Google's latest
- `mistralai/mistral-large` - European alternative
- `openai/gpt-4o` - OpenAI via OpenRouter

### Benefits
- Access to 100+ models from one API
- Often cheaper than direct provider access
- No need for multiple API keys
- Unified billing and usage tracking

---

## Ollama

### Installation

1. **Download Ollama**
   - Go to [ollama.ai](https://ollama.ai)
   - Download for Windows
   - Run the installer

2. **Install Models**
   ```bash
   # Popular models to try
   ollama pull llama3.1:8b      # Meta's Llama 3.1 8B
   ollama pull mistral:7b       # Mistral 7B
   ollama pull codellama:7b     # Code-focused model
   ollama pull qwen2.5:7b       # Alibaba's Qwen 2.5
   ```

3. **Verify Installation**
   ```bash
   ollama list  # See installed models
   ollama serve # Start the server (usually auto-starts)
   ```

### Configuration in LittleLLM
1. Open LittleLLM Settings
2. Go to "Providers" tab
3. Find "Ollama" section
4. Base URL should be: `http://localhost:11434`
5. API Key can be left empty
6. Click "Save Settings"

### Popular Models
- `llama3.1:8b` - General purpose, good balance
- `llama3.1:70b` - Larger, more capable (requires 40GB+ RAM)
- `mistral:7b` - Fast and efficient
- `codellama:7b` - Excellent for coding
- `qwen2.5:7b` - Strong multilingual support

### System Requirements
- **8B models**: 8GB RAM minimum, 16GB recommended
- **70B models**: 40GB RAM minimum
- **Storage**: 4-40GB per model
- **GPU**: Optional but significantly faster

---

## Replicate

### Getting Your API Key

1. **Visit Replicate**
   - Go to [replicate.com](https://replicate.com)
   - Sign up with GitHub or email

2. **Get API Token**
   - Go to [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
   - Click "Create token"
   - Copy the token

3. **Add Billing**
   - Go to [replicate.com/account/billing](https://replicate.com/account/billing)
   - Add payment method
   - Pay-per-use pricing

### Configuration in LittleLLM
1. Open LittleLLM Settings
2. Go to "Providers" tab
3. Find "Replicate" section
4. Paste your API token
5. Click "Save Settings"

### Popular Models
- `meta/llama-2-70b-chat` - Large language model
- `stability-ai/stable-diffusion` - Image generation
- `openai/whisper` - Speech recognition
- `meta/musicgen` - Music generation

---

## Requesty

### Getting Your API Key

1. **Visit Requesty**
   - Go to [app.requesty.ai](https://app.requesty.ai)
   - Sign up for an account

2. **Get API Key**
   - Navigate to API settings
   - Generate new API key
   - Copy the key

### Configuration in LittleLLM
1. Open LittleLLM Settings
2. Go to "Providers" tab
3. Find "Requesty" section
4. Paste your API key
5. Click "Save Settings"

---

## 🛠️ Troubleshooting

### Common Issues

**"Invalid API Key" Error**
- Double-check the key is copied correctly
- Ensure no extra spaces or characters
- Verify the key hasn't expired
- Check if billing is set up (for paid providers)

**"Model not found" Error**
- Refresh the model list in LittleLLM
- Check if the model is available in your region
- Verify you have access to the specific model

**Ollama Connection Failed**
- Ensure Ollama is running: `ollama serve`
- Check if port 11434 is accessible
- Try restarting Ollama service
- Verify models are installed: `ollama list`

**Rate Limiting**
- Wait a few minutes before retrying
- Check your usage limits
- Consider upgrading your plan
- Use different models with higher limits

### Getting Help

1. **Check Provider Status**
   - OpenAI: [status.openai.com](https://status.openai.com)
   - OpenRouter: [status.openrouter.ai](https://status.openrouter.ai)

2. **Review Usage**
   - Check your API usage dashboards
   - Monitor remaining credits/tokens
   - Set up usage alerts

3. **Contact Support**
   - Provider documentation and support
   - LittleLLM GitHub issues
   - Community forums

---

## 💡 Tips for Success

### Cost Management
- Start with cheaper models (GPT-3.5, smaller Ollama models)
- Set usage limits in provider dashboards
- Monitor your spending regularly
- Use local models (Ollama) for development/testing

### Performance Optimization
- Choose models appropriate for your use case
- Use smaller models for simple tasks
- Keep Ollama models on SSD for faster loading
- Consider GPU acceleration for local models

### Security Best Practices
- Never share your API keys
- Use environment variables in development
- Regularly rotate your keys
- Set up usage alerts
- Use separate keys for different applications

---

**Need more help?** Check the [main README](README.md) or create an issue on [GitHub](https://github.com/your-repo/issues).
