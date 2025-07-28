# LittleLLM v3.1.0 🤖💬

A powerful, cross-platform desktop AI chat application that provides seamless access to multiple AI providers with advanced features like MCP (Model Context Protocol) integration, tool calling, memory context, and enhanced vision support.

**Now available on Windows, macOS (Intel + Apple Silicon), and Linux!**

![LittleLLM Screenshot](assets/icon.png)

## ✨ Features

### 🚀 **Multi-Provider Support**
- **OpenAI**: GPT-4o, GPT-4-turbo, GPT-3.5-turbo, O1-preview, O1-mini ✅
- **Anthropic**: Claude 4 Sonnet/Opus, Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku ✅
- **Google Gemini**: Gemini 2.5 Flash/Pro, Gemini 1.5 Pro/Flash ✅
- **Mistral AI**: Mistral Large, Medium, Small, Codestral ✅
- **DeepSeek**: DeepSeek Chat, DeepSeek Coder ✅
- **LM Studio**: Local server for any GGUF model (free) ✅
- **Ollama**: Local models support with enhanced vision capabilities ✅
- **OpenRouter**: 150+ models from multiple providers ✅
- **Requesty**: 80+ models with smart routing ✅
- **Replicate**: Cloud-hosted models ✅
- **n8n**: Custom workflow integration with multipart form data support ✅

> **All 11 providers fully implemented with streaming support, vision capabilities, and tool calling integration**

### 🖼️ **Vision Support**
- Send images directly to vision-capable models
- Automatic image optimization (resize + compression)
- **Enhanced Screenshot Capture**: Full-resolution screenshots with one click
- Supports screenshots, photos, and documents
- OpenRouter vision API integration
- macOS screen recording permission handling

### ⚡ **Quick Access**
- Global keyboard shortcut (Ctrl+Shift+L)
- **Prompts Menu**: Ctrl+Shift+Space or click prompts button 🪄
- **Draggable Overlays**: Move settings and prompts windows anywhere
- Floating window that stays on top
- Minimizes to system tray
- Auto-resize chat input (1-10 lines)
- ESC key to close window

### 🛠️ **Advanced Features**

- **MCP (Model Context Protocol) Integration**: Full support for MCP servers and tools ✨
- **Tool Calling**: User-controlled tool execution with native provider support ✨
- **Memory Context**: Intelligent conversation memory with automatic context retrieval ✨
- **Secure API Key Storage**: Encrypted storage with per-provider model memory ✨
- **Real-time Settings**: Debug logging and settings changes apply immediately ✨
- **Error-Free Experience**: Comprehensive error handling with actionable messages ✨
- **Model Persistence**: Each provider remembers your last selected model across restarts
- **Thinking Sections**: Collapsible display of model reasoning for `<think>` tags
- **Clipboard Integration**: Prompts automatically include clipboard content via `{content}` placeholder
- **Copy Functionality**: One-click copy for entire messages + text selection for partial copying
- **Stop/Cancel**: Interrupt hanging requests
- **Provider-specific settings**: Separate API keys per provider
- **Temperature control**: Adjust model creativity
- **Token limits**: Prevent runaway generation
- **System prompts**: Customize AI behavior
- **Dark mode**: Multiple themes available
- **Token Tracking**: Real-time tokens/second and total usage display ✨
- **Enhanced Response Parsing**: Automatic cleanup of structured responses ✨

### 📁 **Comprehensive File Support**
- **Images**: PNG, JPG, GIF, WebP with automatic optimization
- **Office Documents**: Word (DOCX/DOC), Excel (XLSX/XLS/ODS), PowerPoint (PPTX/PPT)
- **Text Formats**: TXT, MD, RTF, CSV, JSON, HTML, XML
- **Calendar Files**: ICS (iCalendar) with event extraction
- **PDFs**: Native provider support with fallback parsing
- **Intelligent Processing**: Automatic format detection and provider-specific optimization
- **Error Handling**: Comprehensive fallback mechanisms with detailed error reporting
- **Performance Monitoring**: Real-time parsing statistics and success rates
- **Clipboard**: Paste images and text
- **Drag & drop**: Easy file attachment with visual processing indicators

## 🚀 Quick Start

### Download & Install

#### Windows
**Installer (Recommended)**
1. Download `LittleLLM-Setup-2.1.0.exe` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Run the installer (may need "Run as administrator")
3. Follow installation wizard
4. Launch from Desktop shortcut or Start Menu

**Portable Version**
1. Download `LittleLLM-Portable-2.1.0.exe` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Place anywhere (Desktop, USB drive, etc.)
3. Double-click to run - no installation needed

#### macOS
1. Download the appropriate DMG for your Mac:
   - Intel Macs: `LittleLLM-2.1.0-x64.dmg`
   - Apple Silicon: `LittleLLM-2.1.0-arm64.dmg`
   - Universal: `LittleLLM-2.1.0-universal.dmg`
2. Open DMG and drag LittleLLM to Applications folder
3. Right-click and select "Open" on first launch (Gatekeeper)

#### Linux
1. Download `LittleLLM-2.1.0.AppImage` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Make executable: `chmod +x LittleLLM-2.1.0.AppImage`
3. Run: `./LittleLLM-2.1.0.AppImage`

> **✅ Cross-platform builds include all 11 AI providers with MCP integration, tool calling, and enhanced vision support**

📖 **Installation Guides**: [Windows](INSTALLATION.md) | [macOS](INSTALLATION_MAC.md)

### Setup API Keys
1. Click the settings icon ⚙️
2. Select your preferred provider
3. Enter your API key:
   - **OpenAI**: Get from [platform.openai.com](https://platform.openai.com)
   - **Anthropic**: Get from [console.anthropic.com](https://console.anthropic.com)
   - **Google Gemini**: Get from [aistudio.google.com](https://aistudio.google.com)
   - **Mistral AI**: Get from [console.mistral.ai](https://console.mistral.ai)
   - **DeepSeek**: Get from [platform.deepseek.com](https://platform.deepseek.com)
   - **OpenRouter**: Get from [openrouter.ai](https://openrouter.ai)
   - **Requesty**: Get from [app.requesty.ai](https://app.requesty.ai)
   - **LM Studio**: No API key needed (local server)
   - **Ollama**: No API key needed (local models)

### Start Chatting
1. Press **Ctrl+Shift+L** to open the chat window
2. Select a provider and model from the bottom dropdowns
3. Type your message and press Enter
4. Attach images by clicking the paperclip icon or pasting from clipboard
5. Use **Ctrl+Shift+Space** to access quick actions and prompts
6. Toggle tool calling with the 🔧 button next to attachments
7. Manage MCP servers with the 🖥️ dropdown
8. Copy text from clipboard, then select prompts with `{content}` for automatic insertion

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Open/Show LittleLLM |
| `Ctrl+Shift+Space` | Open Action Menu |
| `Ctrl+Shift+V` | Process Clipboard |
| `Esc` | Close window |
| `Enter` | Send message |
| `Shift+Enter` | New line in chat input |
| `Ctrl+V` | Paste (including images) |
| `Ctrl+R` | Reset chat conversation |

## 🎨 Themes

LittleLLM supports 20+ themes including:
- Dark mode (default)
- Light mode
- High contrast
- Custom color schemes

## 🔒 Privacy & Security

- **Local storage**: All settings stored locally
- **No telemetry**: No usage data collected
- **API keys**: Stored securely in encrypted local storage
- **Open source**: Full source code available

## 🐛 Troubleshooting

### Common Issues

**App won't start**
- Check if port 3000 is available
- Try running as administrator

**API errors**
- Verify API key is correct
- Check internet connection
- Ensure sufficient API credits

**Models not loading**
- Check API key permissions
- Try refreshing the model list
- Use fallback models if API is down

### Support
- Create an issue on [GitHub](https://github.com/NickPittas/littlellm/issues)
- Check existing issues for solutions

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or yarn
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Visual Studio Build Tools or Visual Studio Community
- **Linux**: build-essential package

### Setup
```bash
# Clone the repository
git clone https://github.com/NickPittas/littlellm.git
cd littlellm

# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, start Electron
npm run electron-dev
```

### Building

#### Cross-Platform
```bash
# Build for production
npm run build

# Build for current platform
npm run dist
```

#### Windows
```bash
# Build both installer and portable
npm run build:windows

# Build specific versions
npm run dist:win-installer  # Windows installer (.exe)
npm run dist:win-portable   # Windows portable (.exe)
```

#### macOS
```bash
# Build all macOS formats
npm run build:mac

# Build specific formats
npm run dist:mac-dmg        # macOS DMG installer
npm run dist:mac-zip        # macOS ZIP archive
npm run dist:mac-universal  # Universal binary (Intel + Apple Silicon)

# Create macOS icon (requires macOS)
npm run create-mac-icon
```

#### Linux
```bash
npm run dist:linux          # Linux (AppImage)
```

### Platform-Specific Notes

#### macOS Installation
- **Intel Macs**: Download the x64 version
- **Apple Silicon Macs**: Download the arm64 version
- **Universal**: Works on both Intel and Apple Silicon
- **First Launch**: You may need to allow the app in System Preferences > Security & Privacy
- **Gatekeeper**: Right-click the app and select "Open" if you get a security warning

#### Windows Installation
- **Installer**: Recommended for most users, includes automatic updates
- **Portable**: No installation required, runs from any folder
- **Windows Defender**: May flag the app initially, this is normal for new applications

#### Linux Installation
- **AppImage**: Download, make executable (`chmod +x`), and run
- **Dependencies**: Most modern Linux distributions should work out of the box

## 🆕 What's New in v2.1.0

### 🔒 **Enterprise-Grade Security & Reliability** ✨
- **Secure API Key Storage**: All API keys now encrypted with Electron's safeStorage
- **Per-Provider Model Memory**: Each provider remembers your last selected model
- **Real-time Settings Integration**: Debug logging and settings changes apply immediately
- **Comprehensive Error Handling**: Clear, actionable error messages instead of silent failures
- **Race Condition Elimination**: Robust initialization system prevents timing issues

### 🛠️ **System Architecture Improvements**
- **Service Registry**: Dependency injection system eliminates circular dependencies
- **Initialization Manager**: Centralized service initialization prevents duplicate loading
- **Error-Free Model Fetching**: Providers throw proper errors instead of using fallback models
- **Settings Persistence**: Race condition-free settings saving and loading
- **Console Spam Elimination**: Clean, professional console output

### 🎯 **User Experience Enhancements**
- **Always-Functional Save Button**: Settings save button works reliably in all scenarios
- **Immediate Model Loading**: Real models fetched instantly after API key entry
- **Visual Feedback**: Success/error messages for all operations
- **Persistent Preferences**: Model selections and settings remembered across sessions
- **Professional Error Messages**: Clear guidance on how to fix issues

### 🔧 **Technical Excellence**
- **No Silent Failures**: All errors are properly reported and handled
- **Proper Initialization**: Services initialize once and work reliably
- **Memory Efficiency**: Eliminated initialization loops and redundant processing
- **Clean Architecture**: Removed circular dependencies and improved code organization
- **Production Ready**: Enterprise-grade reliability and error handling

### 🎯 **Continued Excellence**
All existing features from v2.0.1 remain fully functional:
- **Cross-Platform Support**: Windows, macOS (Intel + Apple Silicon), and Linux
- **MCP Integration**: Model Context Protocol with tool calling
- **11 AI Providers**: OpenAI, Anthropic, Gemini, Mistral, and more
- **Vision Support**: Image processing across all platforms
- **Memory Context**: Intelligent conversation memory
- **Advanced UI**: Multi-window architecture with theming

## 🏗️ **Tech Stack**
- **Frontend**: Next.js 14, React 18, TypeScript
- **Desktop**: Electron 37.1.0
- **Styling**: Tailwind CSS, Radix UI components
- **Build**: Electron Builder for cross-platform distribution
- **MCP Integration**: @modelcontextprotocol/sdk v1.15.1
- **Testing**: Vitest with comprehensive test coverage

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [Electron](https://electronjs.org/)
- UI components from [Radix UI](https://radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

**LittleLLM v2.1.0** - Your cross-platform AI companion with enterprise-grade security, reliability, and advanced features 🚀

## 📦 **Production Builds**

### Windows
- **Installer**: `LittleLLM-Setup-2.1.0.exe` with proper installation and shortcuts
- **Portable**: `LittleLLM-Portable-2.1.0.exe` for USB/standalone use

### macOS
- **Intel Macs**: `LittleLLM-2.1.0-x64.dmg`
- **Apple Silicon**: `LittleLLM-2.1.0-arm64.dmg`
- **Universal**: `LittleLLM-2.1.0-universal.dmg` (works on both)

### Linux
- **AppImage**: `LittleLLM-2.1.0.AppImage` for universal compatibility

> **✅ All platforms**: No CORS issues, full feature parity, MCP integration included
