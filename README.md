# LittleLLM v3.5.0 🤖💬

A powerful, enterprise-grade desktop AI chat application that provides seamless access to multiple AI providers with advanced features including MCP (Model Context Protocol) integration, intelligent tool calling, knowledge base management, memory systems, modern UI architecture, and comprehensive file processing capabilities.

**Now available on Windows, macOS (Intel + Apple Silicon), and Linux with full TypeScript compliance and zero compilation errors!**

![LittleLLM Screenshot](assets/icon.png)

## ✨ Features

### 🚀 **Multi-Provider AI Support**
- **OpenAI**: GPT-4o, GPT-4-turbo, GPT-3.5-turbo, O1-preview, O1-mini ✅
- **Anthropic**: Claude 4 Sonnet/Opus, Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku ✅
- **Google Gemini**: Gemini 2.5 Flash/Pro, Gemini 1.5 Pro/Flash ✅
- **Mistral AI**: Mistral Large, Medium, Small, Codestral ✅
- **DeepSeek**: DeepSeek Chat, DeepSeek Coder ✅
- **DeepInfra**: High-performance inference platform ✅
- **Groq**: Ultra-fast inference with LPU technology ✅
- **LM Studio**: Local server for any GGUF model (free) ✅
- **Ollama**: Local models support with enhanced vision capabilities ✅
- **OpenRouter**: 150+ models from multiple providers ✅
- **Requesty**: 80+ models with smart routing ✅
- **Replicate**: Cloud-hosted models ✅
- **n8n**: Custom workflow integration with multipart form data support ✅

> **All 13 providers fully implemented with streaming support, vision capabilities, and tool calling integration**

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

### 🎨 **Modern UI Architecture**
- **Magic UI Components**: 150+ animated components with Framer Motion ✨
- **Sidebar Navigation**: Intuitive left sidebar with quick access to all features ✨
- **Floating Panels**: Draggable settings, prompts, and history overlays ✨
- **Real-time Animations**: Smooth transitions and visual feedback throughout ✨
- **Responsive Design**: Auto-resizing windows and adaptive layouts ✨
- **Theme System**: 20+ themes with live preview and instant switching ✨
- **Visual Indicators**: Real-time status for tools, knowledge base, and MCP servers ✨
- **Unified Interface**: Single, cohesive modern interface replacing legacy components ✨

### 🧠 **Knowledge Base & Memory System**
- **Vector Database**: LanceDB-powered knowledge base with semantic search ✨
- **Document Processing**: Intelligent parsing of PDFs, Office docs, text files ✨
- **Batch Upload**: Process multiple documents with real-time progress tracking ✨
- **Smart Chunking**: Automatic text segmentation with overlap for context preservation ✨
- **RAG Integration**: Retrieval-Augmented Generation with relevance scoring ✨
- **Memory Context**: Persistent conversation memory with automatic retrieval ✨
- **Export/Import**: Full knowledge base backup and restore capabilities ✨
- **Search Analytics**: Performance monitoring and success rate tracking ✨

### 🛠️ **Advanced Tool Ecosystem**
- **MCP (Model Context Protocol) Integration**: Full support for MCP servers and tools ✨
- **Internal Commands**: Secure command execution with directory-scoped permissions ✨
- **Tool Calling**: User-controlled tool execution with native provider support ✨
- **Web Search**: Integrated web search capabilities with source attribution ✨
- **File Operations**: Read, write, and manipulate files with safety restrictions ✨
- **Process Management**: Terminal command execution with timeout controls ✨
- **System Monitoring**: CPU usage, memory stats, and process information ✨
- **Custom Agents**: Specialized AI agents with tool-specific configurations ✨

### 🔒 **Enterprise-Grade Security**
- **Encrypted API Storage**: Electron safeStorage for all API keys ✨
- **Secure Command Execution**: Directory-scoped permissions and rate limiting ✨
- **Local Data Storage**: All data stored locally with no telemetry ✨
- **Permission Management**: Granular control over tool and command access ✨
- **Error Handling**: Comprehensive error management with actionable messages ✨
- **Debug Logging**: Configurable logging with privacy protection ✨
- **Settings Persistence**: Race condition-free configuration management ✨
- **Memory Safety**: Automatic cleanup and resource management ✨

### 📁 **Comprehensive File Processing**
- **Images**: PNG, JPG, GIF, WebP with automatic optimization and vision model support
- **Office Documents**: Word (DOCX/DOC), Excel (XLSX/XLS/ODS), PowerPoint (PPTX/PPT)
- **Text Formats**: TXT, MD, RTF, CSV, JSON, HTML, XML with intelligent parsing
- **Calendar Files**: ICS (iCalendar) with event extraction and scheduling
- **PDFs**: Native provider support with OCR fallback and table extraction
- **Knowledge Base Integration**: Automatic document indexing and vector embedding
- **Batch Processing**: Upload multiple files with real-time progress tracking
- **Smart Chunking**: Intelligent text segmentation with context preservation
- **Error Recovery**: Comprehensive fallback mechanisms with detailed reporting
- **Performance Analytics**: Real-time parsing statistics and success rates
- **Clipboard Support**: Paste images and text with automatic format detection
- **Drag & Drop**: Visual file attachment with processing indicators

### 🤖 **Custom Agent Creation System**
- **Specialized Agents**: Create AI agents tailored for specific tasks and workflows
- **Template Library**: Pre-built templates for Document Analysis, Web Research, Code Assistance, and more
- **AI-Generated Prompts**: Use LLMs to automatically generate specialized system prompts
- **Tool Selection**: Choose specific tools and MCP servers for each agent
- **Provider Configuration**: Set default LLM provider and model per agent
- **Import/Export**: Share agents via JSON files with dependency validation
- **Runtime Integration**: Select agents from chat interface with automatic configuration
- **Agent Management**: Visual interface for creating, editing, and organizing agents

#### Built-in Agent Templates
- **📄 Document Analyst**: Specialized for document analysis and summarization
- **🌐 Web Researcher**: Expert at web browsing and information gathering
- **💻 Code Assistant**: Focused on software development and code review
- **📊 Data Analyst**: Expert at data analysis and visualization
- **✍️ Creative Writer**: Specialized in creative writing and content creation
- **📈 Business Analyst**: Expert at business analysis and market research
- **📝 Technical Writer**: Focused on technical documentation creation
- **🎧 Customer Support**: Specialized in customer service and support

## 🚀 Quick Start

### Download & Install

#### Windows
**Installer (Recommended)**
1. Download `LittleLLM-Setup-3.5.0.exe` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Run the installer (may need "Run as administrator")
3. Follow installation wizard
4. Launch from Desktop shortcut or Start Menu

**Portable Version**
1. Download `LittleLLM-Portable-3.5.0.exe` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Place anywhere (Desktop, USB drive, etc.)
3. Double-click to run - no installation needed

#### macOS
1. Download the appropriate DMG for your Mac:
   - Intel Macs: `LittleLLM-3.5.0-x64.dmg`
   - Apple Silicon: `LittleLLM-3.5.0-arm64.dmg`
   - Universal: `LittleLLM-3.5.0-universal.dmg`
2. Open DMG and drag LittleLLM to Applications folder
3. Right-click and select "Open" on first launch (Gatekeeper)

#### Linux
1. Download `LittleLLM-3.5.0.AppImage` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Make executable: `chmod +x LittleLLM-3.5.0.AppImage`
3. Run: `./LittleLLM-3.5.0.AppImage`

> **✅ Cross-platform builds include modern UI, knowledge base, 13 AI providers, MCP integration, tool calling, and enhanced vision support**

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
1. Press **Ctrl+Shift+L** to open the modern chat interface
2. Select a provider and model from the bottom input area
3. Type your message and press Enter or click the send button
4. Attach files by clicking the paperclip icon or drag & drop
5. Take screenshots with the camera icon for instant image capture
6. Use the sidebar to access settings, agents, prompts, and chat history
7. Toggle tools, knowledge base, and MCP servers with the bottom toolbar buttons
8. Upload documents to the knowledge base for RAG-enhanced conversations
9. Create custom agents for specialized tasks and workflows
10. Copy text from clipboard, then select prompts with `{content}` for automatic insertion

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Open/Show LittleLLM Modern Interface |
| `Ctrl+Shift+Space` | Open Action Menu (Prompts) |
| `Ctrl+Shift+V` | Process Clipboard |
| `Esc` | Close window |
| `Enter` | Send message |
| `Shift+Enter` | New line in chat input |
| `Ctrl+V` | Paste (including images) |
| `Ctrl+R` | Reset chat conversation |
| `Ctrl+N` | Start new chat |
| `Ctrl+H` | Toggle chat history panel |
| `Ctrl+S` | Open settings |
| `Ctrl+T` | Toggle tools |

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

## 🆕 What's New in v3.5.0

### 🎨 **Modern UI Revolution** ✨
- **Complete UI Overhaul**: New modern interface with Magic UI components and Framer Motion animations
- **Sidebar Navigation**: Intuitive left sidebar with quick access to all features
- **Real-time Animations**: Smooth transitions and visual feedback throughout the application
- **Unified Interface**: Single cohesive modern interface replacing all legacy components
- **Enhanced User Experience**: Improved layouts, better visual hierarchy, and intuitive controls

### 🧠 **Knowledge Base & RAG System** ✨
- **Vector Database Integration**: LanceDB-powered knowledge base with semantic search
- **Intelligent Document Processing**: Advanced parsing for PDFs, Office docs, and text files
- **Batch Upload System**: Process multiple documents with real-time progress tracking
- **RAG Integration**: Retrieval-Augmented Generation with relevance scoring and source attribution
- **Smart Chunking**: Automatic text segmentation with overlap for context preservation

### 🛠️ **Advanced Tool Ecosystem** ✨
- **Internal Commands**: Secure command execution with directory-scoped permissions
- **Web Search Integration**: Built-in web search capabilities with source attribution
- **File Operations**: Read, write, and manipulate files with comprehensive safety restrictions
- **Process Management**: Terminal command execution with timeout controls and monitoring
- **System Monitoring**: CPU usage, memory stats, and detailed process information

### 🤖 **Custom Agent System** ✨
- **Agent Creation**: Build specialized AI agents with custom tool configurations
- **Template Library**: Pre-built templates for various use cases and workflows
- **Runtime Integration**: Select and switch agents directly from the chat interface
- **Tool Selection**: Granular control over which tools and MCP servers each agent can access
- **Import/Export**: Share agents via JSON files with dependency validation

### 🔒 **Enterprise Security & Reliability** ✨
- **Zero TypeScript Errors**: Complete codebase compliance with full type safety
- **Enhanced Error Handling**: Comprehensive error management with actionable messages
- **Secure Storage**: Encrypted API key storage with Electron's safeStorage
- **Permission Management**: Granular control over tool and command access
- **Debug Logging**: Configurable logging system with privacy protection

### 📊 **Performance & Quality** ✨
- **Memory Management**: Intelligent conversation memory with automatic context retrieval
- **Real-time Monitoring**: Performance analytics and success rate tracking
- **Batch Processing**: Efficient handling of multiple files and operations
- **Resource Optimization**: Automatic cleanup and memory management
- **Error Recovery**: Comprehensive fallback mechanisms with detailed reporting

## 🏗️ **Tech Stack**
- **Frontend**: Next.js 14, React 18, TypeScript (Zero compilation errors)
- **Desktop**: Electron 37.1.0 with secure IPC communication
- **UI Framework**: Magic UI components with Framer Motion animations
- **Styling**: Tailwind CSS with custom design system
- **Database**: LanceDB for vector storage and semantic search
- **Build**: Electron Builder for cross-platform distribution
- **MCP Integration**: @modelcontextprotocol/sdk v1.15.1
- **Testing**: Vitest with comprehensive test coverage
- **Memory**: JSON-based memory system with intelligent retrieval
- **Security**: Electron safeStorage for encrypted API key management

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [Electron](https://electronjs.org/)
- UI components from [Radix UI](https://radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

**LittleLLM v3.5.0** - Your modern, enterprise-grade AI companion with advanced knowledge base, tool ecosystem, and beautiful UI 🚀

## 📦 **Production Builds**

### Windows Builds
- **Installer**: `LittleLLM-Setup-3.5.0.exe` with proper installation and shortcuts
- **Portable**: `LittleLLM-Portable-3.5.0.exe` for USB/standalone use

### macOS Builds
- **Intel Macs**: `LittleLLM-3.5.0-x64.dmg`
- **Apple Silicon**: `LittleLLM-3.5.0-arm64.dmg`
- **Universal**: `LittleLLM-3.5.0-universal.dmg` (works on both)

### Linux Builds
- **AppImage**: `LittleLLM-3.5.0.AppImage` for universal compatibility

> **✅ All platforms**: Modern UI, knowledge base, 13 AI providers, MCP integration, tool calling, and zero TypeScript errors
