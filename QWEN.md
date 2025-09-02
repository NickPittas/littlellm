# LittleLLM v4.2.0 - Project Context

## Project Overview

LittleLLM is an enterprise-grade desktop AI chat application built with a TypeScript-first architecture using Next.js and Electron. It provides seamless access to 13+ AI providers with advanced features including MCP (Model Context Protocol) integration, intelligent tool calling, comprehensive knowledge base management with RAG, custom agent creation, memory systems, modern UI architecture, and extensive file processing capabilities.

The application is cross-platform (Windows, macOS, Linux) with zero compilation errors and supports a wide range of AI models including OpenAI, Anthropic, Google Gemini, Mistral AI, DeepSeek, DeepInfra, LM Studio, Jan AI, Ollama, OpenRouter, Requesty, Replicate, and n8n.

## Core Features

### Multi-Provider AI Support
- Supports 13 providers with broad streaming support, vision capabilities, and tool calling integration
- Unified interface for diverse LLM APIs

### Vision Support
- Send images directly to vision-capable models
- Automatic image optimization
- Enhanced screenshot capture

### Quick Access
- Global keyboard shortcut (Ctrl+Shift+L)
- Prompts menu and floating window
- Minimizes to system tray

### Modern UI Architecture
- Magic UI components with Framer Motion
- Sidebar navigation and floating panels
- Real-time animations and responsive design
- Theme system with live preview

### Advanced Knowledge Base & RAG System
- LanceDB vector database for semantic search
- Multi-format document processing (PDF, DOCX, XLSX, TXT, RTF, HTML, XML, ICS)
- Batch document upload with progress tracking
- Google Docs integration
- Smart text chunking and intelligent RAG integration
- Knowledge base registry and migration/backup system

### Advanced Tool Ecosystem
- Full MCP integration
- Internal commands with directory-scoped permissions
- Tool calling with native provider support
- Web search and file operations
- System monitoring and custom agents

### Enterprise-Grade Security
- Encrypted API storage
- Secure command execution
- Local data storage with no telemetry
- Permission management

### Enterprise-Grade File Processing
- Support for vision, Office suite, text/markup, and calendar files
- Knowledge base auto-indexing
- High-performance batch processing
- Enhanced clipboard and drag & drop support

### Advanced Agent Management System
- Custom agent creation
- Template library and AI-powered prompt generation
- Granular tool selection and provider/model configuration
- Agent import/export and runtime switching

## Technology Stack

### Core Framework
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript 5.8.3
- **Desktop**: Electron 37.1.0 with secure IPC communication
- **Build System**: Electron Builder 25.1.8 for cross-platform distribution
- **Type Safety**: Complete TypeScript compliance

### UI & Styling
- **Components**: Magic UI with Framer Motion 12.23.9
- **Primitives**: Radix UI
- **Styling**: Tailwind CSS 3.4.1
- **Icons**: Lucide React

### Database & Storage
- **Vector DB**: LanceDB 0.21.1
- **Secure Storage**: Electron safeStorage
- **File System**: JSON-based configuration

### AI & ML Integration
- **Embeddings**: @xenova/transformers 2.17.2
- **MCP Protocol**: @modelcontextprotocol/sdk 1.15.1
- **Multi-Provider**: 13+ LLM providers

### Document Processing
- **PDF**: pdf-parse 1.1.1, pdfjs-dist 5.4.54
- **Office**: mammoth 1.9.1 (Word), xlsx 0.18.5 (Excel)
- **Text**: RTF parser, XML2JS, HTML parser
- **Images**: Sharp 0.34.3
- **Calendar**: ical.js 2.2.0

## Architecture & Key Services

### LLM Service Architecture
- Central `llmService` manages all provider interactions
- Uses `ProviderAdapter` and `ProviderFactory` for new provider architecture
- Each provider implements `ILLMProvider` interface (e.g., `AnthropicProvider`)
- Supports unified tool calling, streaming, and model management

### Chat Service
- Main interface for sending messages and handling files
- Integrates RAG for knowledge base augmentation
- Manages conversation history and token usage tracking

### Tool Execution System
- Supports MCP tools, memory tools, and internal commands
- Parallel tool execution with result formatting
- Error categorization and user-friendly messages

### Knowledge Base System
- LanceDB-based vector storage
- Multi-format document parsing
- RAG integration with relevance scoring

### Agent System
- Customizable agent configurations
- Agent-specific RAG context and tool selection
- Agent templates and import/export functionality

## Development & Building

### Setup
- Node.js 18+, npm/yarn
- Platform-specific build tools (Xcode, Visual Studio, build-essential)

### Key Scripts
- `npm run dev`: Start development server
- `npm run build`: Production build
- `npm run dist`: Build for current platform
- `npm run dist:win-*`, `npm run dist:mac-*`, `npm run dist:linux`: Platform-specific builds

### Building for Different Platforms
- Cross-platform builds include modern UI, knowledge base, and all core features
- Specific commands for Windows (installer/portable), macOS (DMG/ZIP/universal), and Linux (AppImage)

## Configuration & Settings

- API keys stored securely in Electron safeStorage
- Provider-specific settings (base URLs, last selected models)
- Chat settings (model, temperature, max tokens, system prompt)
- Tool calling and RAG toggle configurations
- Conversation history length limits

## Security & Privacy

- Local storage of all settings
- No telemetry or data collection
- Encrypted API key storage
- Directory-scoped permissions for internal commands

## Troubleshooting

- Common issues: Port conflicts, API errors, model loading failures
- Support through GitHub issues