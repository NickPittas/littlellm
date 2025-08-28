# LittleLLM v4.2.0 🤖💬

A powerful, enterprise-grade desktop AI chat application that provides seamless access to multiple AI providers with advanced features including MCP (Model Context Protocol) integration, intelligent tool calling, comprehensive knowledge base management, custom agent creation, memory systems, modern UI architecture, and extensive file processing capabilities.

**Now available on Windows, macOS (Intel + Apple Silicon), and Linux with a TypeScript-first architecture and zero compilation errors.**

![LittleLLM Screenshot](assets/icon.png)

## ✨ Features

### 🚀 **Multi-Provider AI Support**
- **OpenAI**: GPT-4o, GPT-4-turbo, GPT-3.5-turbo, O1-preview, O1-mini ✅
- **Anthropic**: Claude 4 Sonnet/Opus, Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku ✅
- **Google Gemini**: Gemini 2.5 Flash/Pro, Gemini 1.5 Pro/Flash ✅
- **Mistral AI**: Mistral Large, Medium, Small, Codestral ✅
- **DeepSeek**: DeepSeek Chat, DeepSeek Coder ✅
- **DeepInfra**: High-performance inference platform ✅
- **LM Studio**: Local server for any GGUF model (free) ✅
- **Jan AI**: Privacy-first local AI with OpenAI-compatible API ✅
- **Ollama**: Local models support with enhanced vision capabilities ✅
- **OpenRouter**: 150+ models from multiple providers ✅
- **Requesty**: 80+ models with smart routing ✅
- **Replicate**: Cloud-hosted models ✅
- **n8n**: Custom workflow integration with multipart form data support ✅

> 13 providers with broad streaming support, vision capabilities, and tool calling integration (where supported)

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
- Floating window that stays on top
- Minimizes to system tray
- Auto-resize chat input (1.25–5 lines)
- Esc key closes overlays and dialogs

### 🎨 **Modern UI Architecture**
- **Magic UI Components**: Polished animated components with Framer Motion ✨
- **Sidebar Navigation**: Intuitive left sidebar with quick access to all features ✨
- **Floating Panels**: Draggable settings, prompts, and history overlays ✨
- **Real-time Animations**: Smooth transitions and visual feedback throughout ✨
- **Responsive Design**: Auto-resizing windows and adaptive layouts ✨
- **Theme System**: Predefined themes with live preview and instant switching ✨
- **Visual Indicators**: Real-time status for tools, knowledge base, and MCP servers ✨
- **Unified Interface**: Single, cohesive modern interface replacing legacy components ✨

### 🧠 **Advanced Knowledge Base & RAG System**
- **LanceDB Vector Database**: High-performance vector storage with semantic search capabilities ✨
- **Multi-Format Document Processing**: Intelligent parsing of PDFs, DOCX, XLSX, TXT, RTF, HTML, XML, and more ✨
- **Batch Document Upload**: Process multiple documents simultaneously with real-time progress tracking ✨
- **Google Docs Integration**: Direct import from Google Docs URLs with automatic text extraction ✨
- **Smart Text Chunking**: Advanced text segmentation with configurable overlap for context preservation ✨
- **Intelligent RAG Integration**: Retrieval-Augmented Generation with relevance scoring and source attribution ✨
- **Knowledge Base Registry**: Centralized management system for multiple knowledge bases ✨
- **Migration & Backup**: Complete knowledge base export/import with version control ✨
- **Performance Analytics**: Real-time search analytics, success rate tracking, and optimization insights ✨
- **Metadata-Based Filtering**: Advanced search filtering by document type, date, source, and custom tags ✨
- **Context Window Management**: Intelligent token limit handling for optimal LLM performance ✨

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

### 📁 **Enterprise-Grade File Processing**
- **Vision Support**: PNG, JPG, GIF, WebP with automatic optimization and multi-model vision support ✨
- **Office Suite**: Word (DOCX/DOC), Excel (XLSX/XLS/ODS), PowerPoint (PPTX/PPT) with table extraction ✨
- **Text & Markup**: TXT, MD, RTF, CSV, JSON, HTML, XML with intelligent structure parsing ✨
- **Calendar Integration**: ICS (iCalendar) with event extraction, scheduling, and timezone support ✨
- **Advanced PDF Processing**: Native provider support with OCR fallback, table extraction, and metadata preservation ✨
- **Knowledge Base Auto-Indexing**: Automatic document indexing with vector embedding and semantic search ✨
- **High-Performance Batch Processing**: Upload and process multiple files simultaneously with progress tracking ✨
- **Intelligent Text Chunking**: Smart segmentation with configurable overlap and context preservation ✨
- **Robust Error Recovery**: Comprehensive fallback mechanisms with detailed error reporting and retry logic ✨
- **Real-Time Analytics**: Live parsing statistics, success rates, and performance monitoring ✨
- **Enhanced Clipboard Support**: Paste images, text, and files with automatic format detection ✨
- **Modern Drag & Drop**: Visual file attachment with real-time processing indicators and validation ✨
- **Document Migration**: Seamless import/export with version control and data integrity checks ✨

### 🤖 **Advanced Agent Management System**
- **Custom Agent Creation**: Build specialized AI agents tailored for specific tasks and workflows ✨
- **Comprehensive Template Library**: Pre-built templates for Document Analysis, Web Research, Code Assistance, and more ✨
- **AI-Powered Prompt Generation**: Use LLMs to automatically generate specialized system prompts ✨
- **Granular Tool Selection**: Choose specific tools and MCP servers for each agent with advanced configuration ✨
- **Provider & Model Configuration**: Set default LLM provider, model, temperature, and token limits per agent ✨
- **Knowledge Base Integration**: Link agents to specific knowledge bases for enhanced RAG capabilities ✨
- **Agent Import/Export**: Share agents via JSON files with comprehensive dependency validation ✨
- **Runtime Agent Switching**: Select and switch agents directly from chat interface with automatic configuration ✨
- **Visual Agent Management**: Modern UI for creating, editing, duplicating, and organizing agents ✨
- **Agent Lifecycle Management**: Complete CRUD operations with version tracking and metadata ✨
- **Template System**: Reusable agent templates with categorization and customization options ✨

#### Built-in Agent Templates
- **📄 Document Analyst**: Specialized for document analysis, summarization, and content extraction
- **🌐 Web Researcher**: Expert at web browsing, information gathering, and source verification
- **💻 Code Assistant**: Focused on software development, code review, and debugging
- **📊 Data Analyst**: Expert at data analysis, visualization, and statistical interpretation
- **✍️ Creative Writer**: Specialized in creative writing, content creation, and storytelling
- **📈 Business Analyst**: Expert at business analysis, market research, and strategic planning
- **📝 Technical Writer**: Focused on technical documentation, API docs, and user guides
- **🎧 Customer Support**: Specialized in customer service, support ticket resolution, and FAQ generation

## 🚀 Quick Start

> **✅ Cross-platform builds include modern UI, knowledge base, 13 AI providers, MCP integration, tool calling, and enhanced vision support**

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
   - **Jan AI**: API key may be required (local AI application)
   - **Ollama**: No API key needed (local models)

### Start Using Advanced Features
1. Press **Ctrl+Shift+L** to open the modern chat interface
2. Select a provider and model from the bottom input area
3. **Upload Documents to Knowledge Base**: 
   - Click the knowledge base icon in the sidebar
   - Upload PDFs, Office docs, or enter Google Docs URLs
   - Watch real-time processing progress
   - Enable RAG toggle for enhanced responses
4. **Create Custom Agents**:
   - Access agent management from the sidebar
   - Choose from pre-built templates or create custom agents
   - Configure tools, knowledge bases, and LLM settings
   - Switch agents directly from the chat interface
5. **Enhanced Chat Experience**:
   - Type messages and press Enter or click send
   - Attach files via paperclip icon or drag & drop
   - Take screenshots with the camera icon
   - Use tool calling toggle for advanced functionality
   - Access prompts with Ctrl+Shift+Space
6. **Knowledge Base Management**:
   - Create multiple knowledge bases for different topics
   - Monitor search analytics and performance
   - Export/import knowledge bases for backup
   - Configure RAG settings for optimal results
7. **Advanced Features**:
   - Copy text from clipboard, then select prompts with `{content}` for automatic insertion
   - Use MCP servers for extended functionality
   - Access chat history and memory management
   - Customize themes and transparency settings

## 🔑 Keyboard Shortcuts & Quick Actions

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Open/Show LittleLLM Modern Interface |
| `Ctrl+Shift+Space` | Open Action Menu (Prompts) |
| `Ctrl+Shift+V` | Process Clipboard Content |
| `Esc` | Close overlays/dialogs |
| `Enter` | Send message |
| `Shift+Enter` | New line in chat input |
| `Ctrl+V` | Paste (including images and files) |
| `Ctrl+K` | Quick knowledge base search (when enabled) |
| `Ctrl+A` | Quick agent selection menu |
| `F11` | Toggle fullscreen mode |

### Quick Access Features
- **Knowledge Base Toggle**: Click the brain icon to enable/disable RAG
- **Agent Switching**: Use the agent dropdown for instant agent selection
- **Tool Calling**: Toggle tools on/off with the wrench icon
- **MCP Servers**: Manage MCP server connections from settings
- **File Upload**: Drag & drop files anywhere or use the paperclip icon
- **Screenshot**: Camera icon for instant screen capture

## 🎨 Themes

LittleLLM includes predefined themes such as:

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

### Platform-Specific Build Artifacts

#### macOS (artifacts)

- After running the macOS build commands (dist:mac / dist:mac-dmg / dist:mac-zip / dist:mac-universal), DMG/ZIP artifacts are created in the `dist/` folder
- Targets: x64, arm64, or universal (as configured)
- First launch: you may need to allow the app in System Settings > Privacy & Security, or right-click and select "Open"

#### Windows (artifacts)

- After running the Windows build commands (dist:win-installer / dist:win-portable), NSIS installer and Portable executables are created in the `dist/` folder
- Portable: runs without installation; Installer: recommended for most users
- Windows Defender may flag the app initially for new unsigned builds

#### Linux (artifacts)

- After running the Linux build command (dist:linux), an AppImage is created in the `dist/` folder
- Make executable: `chmod +x LittleLLM-<version>.AppImage`
- Run the AppImage directly on most modern Linux distributions

## 🆕 What's New in v4.2.0

### 🧠 **Enhanced Knowledge Base Management** ✨

- **Knowledge Base Registry**: Centralized management system for multiple knowledge bases with metadata tracking
- **Advanced Document Processing**: Support for Google Docs URLs, batch processing, and improved text extraction
- **Migration & Backup System**: Complete knowledge base export/import with version control and data integrity
- **Performance Optimization**: Enhanced chunking strategies, improved search algorithms, and better memory management
- **Integration Testing**: Comprehensive test suite for knowledge base operations and RAG functionality

### 🤖 **Advanced Agent Management** ✨

- **Comprehensive Agent System**: Complete lifecycle management with creation, editing, duplication, and deletion
- **Knowledge Base Integration**: Link agents to specific knowledge bases for enhanced RAG-powered responses
- **Agent Templates**: Expanded template library with specialized configurations for different use cases
- **Enhanced UI Components**: Modern interface for agent management with drag-and-drop organization
- **Import/Export Functionality**: Share agents via JSON with dependency validation and version tracking

### 🔧 **System Architecture Improvements** ✨

- **Zero Compilation Errors**: Complete TypeScript compliance across the entire codebase
- **Enhanced IPC Communication**: Improved Electron-Next.js integration with proper type safety
- **Service Layer Refactoring**: Modular service architecture with better separation of concerns
- **Memory Management**: Intelligent cleanup and resource optimization for better performance
- **Error Handling**: Comprehensive error management with detailed logging and user feedback

### 📁 **File Processing Enhancements** ✨

- **Document Parser Service**: Dedicated service for handling multiple file formats with improved reliability
- **Progress Monitoring**: Real-time progress tracking for document processing and knowledge base operations
- **Batch Operations**: Enhanced batch processing capabilities with parallel document handling
- **Error Recovery**: Robust fallback mechanisms for failed document processing
- **Content Parsing**: Improved text extraction with better handling of complex document structures

### 🛠️ **Development & Quality** ✨

- **Integration Testing**: Comprehensive test suite for knowledge base and agent management features
- **Migration Scripts**: Automated migration system for upgrading knowledge base structures
- **Code Quality**: Enhanced TypeScript definitions, better error handling, and improved documentation
- **Performance Analytics**: Real-time monitoring and analytics for system performance
- **Debug Capabilities**: Enhanced logging and debugging tools for better troubleshooting

## 🏗️ **Architecture & Tech Stack**

### Core Framework
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript 5.8.3
- **Desktop**: Electron 37.1.0 with secure IPC communication and context isolation
- **Build System**: Electron Builder 25.1.8 for cross-platform distribution
- **Type Safety**: Complete TypeScript compliance with zero compilation errors

### UI & Styling
- **Component Library**: Magic UI components with Framer Motion 12.23.9 animations
- **Design System**: Radix UI primitives with custom component extensions
- **Styling**: Tailwind CSS 3.4.1 with custom design tokens and themes
- **Icons**: Lucide React with comprehensive icon set
- **Responsive Design**: Adaptive layouts with drag-and-drop interfaces

### Database & Storage
- **Vector Database**: LanceDB 0.21.1 for high-performance semantic search
- **Document Processing**: Multi-format parsers (PDF, Office, text, calendar)
- **Secure Storage**: Electron safeStorage for encrypted API key management
- **File System**: JSON-based configuration with atomic writes
- **Memory Management**: Intelligent conversation context with automatic cleanup

### AI & ML Integration
- **Embeddings**: @xenova/transformers 2.17.2 for local text embeddings
- **MCP Protocol**: @modelcontextprotocol/sdk 1.15.1 for tool integration
- **Multi-Provider**: 13+ LLM providers with unified interface
- **RAG System**: Advanced retrieval-augmented generation with relevance scoring
- **Agent Framework**: Custom agent creation with template system

### Document Processing
- **PDF**: pdf-parse 1.1.1 with pdfjs-dist 5.4.54 for comprehensive text extraction
- **Office**: mammoth 1.9.1 (Word), xlsx 0.18.5 (Excel), node-pptx-parser (PowerPoint)
- **Text Formats**: RTF parser, XML2JS, HTML parser with intelligent content extraction
- **Images**: Sharp 0.34.3 for optimization and vision model integration
- **Calendar**: ical.js 2.2.0 for ICS file processing

### Security & Performance
- **Encrypted Storage**: Electron safeStorage with secure key management
- **Process Isolation**: Sandboxed renderer with secure IPC channels
- **Memory Safety**: Automatic resource cleanup and leak prevention
- **Error Handling**: Comprehensive error management with detailed logging
- **Performance Monitoring**: Real-time analytics and optimization insights

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [Electron](https://electronjs.org/)
- UI components from [Radix UI](https://radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

**LittleLLM v4.2.0** - Your modern, enterprise-grade AI companion.

With advanced knowledge base management, custom agent creation, and comprehensive tool ecosystem. 🚀

