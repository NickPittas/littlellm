# LittleLLM Project Mindmap & Architecture Guide

## 🏗️ Project Overview
LittleLLM is an Electron-based desktop AI chat application built with Next.js, React, and TypeScript. It provides a native Windows experience for AI conversations with multiple providers.

## 📁 Directory Structure

### Root Level
- `package.json` - Dependencies, scripts, and project metadata
- `next.config.js` - Next.js configuration with production export settings
- `electron-builder.json` - Electron packaging configuration
- `tailwind.config.js` - Tailwind CSS styling configuration
- `tsconfig.json` - TypeScript configuration

### Core Directories

#### `/src` - Frontend Source Code
**Main Application Entry:**
- `app/page.tsx` - Next.js app router entry point
- `app/layout.tsx` - Root layout with theme providers

**Components (`/src/components`):**
- `VoilaInterface.tsx` - **MAIN CHAT INTERFACE**
  - Manages chat state, messages, file attachments
  - Handles window resizing and expansion
  - Integrates all other components
  - Controls conversation flow

- `ChatInterface.tsx` - **CORE CHAT COMPONENT**
  - Message display and input handling
  - Streaming response management
  - File attachment processing
  - Integration with LLM services

- `BottomToolbarNew.tsx` - **PROVIDER/MODEL SELECTION**
  - Provider dropdown with dynamic model fetching
  - Model persistence per provider
  - File upload and screenshot buttons
  - Settings and history access

- `MessageWithThinking.tsx` - **AI RESPONSE RENDERER**
  - Parses `<think>` tags for collapsible thinking sections
  - Copy functionality for responses
  - Markdown-like formatting

- `UserMessage.tsx` - **USER MESSAGE RENDERER**
  - Copy functionality for user messages
  - Text selection support

- `ActionMenuOverlay.tsx` - **QUICK ACTIONS MENU**
  - Prompt selection interface
  - Clipboard integration
  - Triggered by Ctrl+Shift+Space

- `SettingsOverlay.tsx` - **SETTINGS INTERFACE**
  - API key management for all providers
  - Theme selection and UI preferences
  - Shortcut customization

- `HistoryDialog.tsx` - **CONVERSATION HISTORY**
  - Load previous conversations
  - Conversation management

**UI Components (`/src/components/ui`):**
- `button.tsx` - Reusable button component with variants
- `dialog.tsx` - Modal dialog components
- `select.tsx` - Dropdown selection components
- `electron-dropdown.tsx` - Custom dropdown for Electron environment
- `searchable-select.tsx` - Searchable dropdown with fuzzy search
- `textarea.tsx` - Text input areas
- `input.tsx` - Single-line inputs
- `command.tsx` - Command palette components

#### `/src/services` - Business Logic Layer

**Core Services:**

- `llmService.ts` - **LLM PROVIDER MANAGEMENT**
  - Manages 10 AI providers: OpenAI, Anthropic, Gemini, Mistral, DeepSeek, LMStudio, Ollama, OpenRouter, Requesty, Replicate
  - Dynamic model fetching with caching
  - Provider-specific API implementations
  - Streaming response handling
  - Vision model support detection

- `chatService.ts` - **CHAT ORCHESTRATION**
  - Message processing and formatting
  - File attachment handling (images, PDFs, text files)
  - Vision model integration
  - Conversation history management

- `settingsService.ts` - **SETTINGS MANAGEMENT**
  - JSON file persistence for settings
  - Provider API key storage
  - UI preferences and shortcuts
  - Model persistence per provider

- `conversationHistoryService.ts` - **CONVERSATION PERSISTENCE**
  - Individual JSON files per conversation
  - Conversation indexing and search
  - Automatic title generation
  - History cleanup (max 50 conversations)

- `promptsService.ts` - **PROMPT MANAGEMENT**
  - Default prompts from JSON data
  - Custom prompt creation and storage
  - Prompt processing with `{content}` replacement
  - Category organization

#### `/src/utils` - Utility Functions
- `storage.ts` - Electron storage abstraction
- `fileUtils.ts` - File processing utilities
- `themeUtils.ts` - Theme management helpers

#### `/src/contexts` - React Context Providers
- Theme context for dark/light mode switching
- Settings context for global state management

#### `/src/data` - Static Data
- `prompts.json` - Default prompt templates organized by category

### `/electron` - Desktop Application Layer

**Main Process (`electron/main.ts`):**
- **Window Management**: Creates main window, settings overlay, action menu
- **IPC Handlers**: 50+ handlers for frontend-backend communication
- **System Integration**: Global shortcuts, tray icon, clipboard access
- **File System**: Settings and conversation file management
- **Screenshot Capture**: Desktop screenshot functionality
- **Port Detection**: Automatic Next.js dev server detection

**Preload Script (`electron/preload.ts`):**
- **Security Bridge**: Safe API exposure to renderer process
- **IPC Methods**: Clipboard, settings, storage, window controls
- **Type Definitions**: TypeScript interfaces for exposed APIs

### `/assets` - Static Resources
- Application icons (ICO, PNG, SVG formats)
- Tray icons for system integration

### `/scripts` - Build and Utility Scripts
- `build-windows.js` - Windows build automation
- `fix-paths.js` - Post-build path corrections
- Icon generation utilities

## 🔄 Data Flow & Component Interactions

### Application Startup Flow
1. **Electron Main Process** (`main.ts`) starts
2. **Static Server** created for production builds
3. **Main Window** created with Next.js app
4. **VoilaInterface** mounts as root component
5. **Settings** loaded from JSON files
6. **Providers** initialized with cached models

### Chat Message Flow
1. **User Input** → `VoilaInterface` → `ChatInterface`
2. **Message Processing** → `chatService.sendMessage()`
3. **Provider Selection** → `llmService` routes to specific provider
4. **API Call** → Provider-specific implementation
5. **Streaming Response** → Real-time UI updates
6. **Message Storage** → `conversationHistoryService`

### Settings Management Flow
1. **Settings UI** → `SettingsOverlay` component
2. **Settings Update** → `settingsService.updateSettings()`
3. **File Persistence** → JSON file write via Electron IPC
4. **Provider Refresh** → Model cache invalidation
5. **UI Update** → React state propagation

### File Attachment Flow
1. **File Selection** → `BottomToolbar` file input
2. **File Processing** → `chatService` handles different types
3. **Vision Detection** → Check if current model supports images
4. **Message Formatting** → Convert to provider-specific format
5. **API Transmission** → Include in LLM request

## 🎯 Key Features & Button Functions

### Bottom Toolbar Buttons
- **Provider Dropdown**: Select AI provider (OpenAI, Anthropic, etc.)
- **Model Dropdown**: Select specific model with fuzzy search
- **Attach Button** (📎): Upload files (jpg, png, txt, pdf, md, log)
- **Screenshot Button** (📷): Capture desktop screenshot
- **Settings Button** (⚙️): Open settings overlay
- **History Button** (📚): Access conversation history

### Action Menu (Ctrl+Shift+Space)
- **Prompt Selection**: Quick access to categorized prompts
- **Clipboard Integration**: Auto-replace `{content}` with clipboard text
- **Fuzzy Search**: Find prompts quickly

### Message Features
- **Thinking Sections**: Collapsible `<think>` tag content
- **Copy Buttons**: Copy individual messages or parts
- **Text Selection**: Select and copy portions of responses
- **Streaming Display**: Real-time response rendering

### Window Controls
- **Auto-Resize**: Window expands when chat starts
- **Draggable**: Click anywhere to drag window
- **Always On Top**: Stays above other applications
- **Transparent Background**: Floating window appearance

## 🔧 Technical Implementation Details

### Provider Architecture
Each provider implements standardized interface:
- `fetchModels()` - Dynamic model discovery
- `sendMessage()` - Chat completion with streaming
- `supportsVision()` - Image capability detection
- Error handling and fallback mechanisms

### Storage Strategy
- **Settings**: Single JSON file with nested provider configs
- **Conversations**: Individual JSON files per conversation
- **Prompts**: Static JSON + custom additions
- **Cache**: In-memory model lists with TTL

### Security Model
- **Context Isolation**: Electron security best practices
- **API Key Storage**: Local JSON files only
- **No Network Exposure**: All APIs called from main process
- **File Validation**: Strict file type checking

### Performance Optimizations
- **Model Caching**: 5-minute TTL for provider models
- **Lazy Loading**: Components load on demand
- **Streaming**: Real-time response display
- **Memory Management**: Conversation history limits

## 🚨 Critical Dependencies & Relationships

### Component Dependencies
- `VoilaInterface` → All other components (root orchestrator)
- `ChatInterface` → `MessageWithThinking`, `UserMessage`
- `BottomToolbar` → `llmService`, `settingsService`
- All components → UI component library

### Service Dependencies
- `chatService` → `llmService`, `conversationHistoryService`
- `llmService` → Provider-specific implementations
- `settingsService` → Electron IPC for file operations
- `promptsService` → Static data + storage service

### Critical Files for Functionality
- `llmService.ts` - Core AI provider logic
- `main.ts` - Electron application lifecycle
- `VoilaInterface.tsx` - Main UI orchestration
- `settingsService.ts` - Configuration persistence
- `package.json` - Build and dependency management

## 📝 Development Guidelines

### Before Creating New Functions
1. **Check this mindmap** for existing implementations
2. **Search codebase** for similar functionality
3. **Review service layer** for reusable methods
4. **Consider component hierarchy** for proper placement

### When Modifying Existing Code
1. **Update this mindmap** to reflect changes
2. **Check dependent components** for breaking changes
3. **Test provider integrations** after LLM service changes
4. **Verify Electron IPC** after main process modifications

### Common Patterns
- **Settings Changes**: Always go through `settingsService`
- **Provider Operations**: Route through `llmService`
- **UI State**: Use React hooks and context
- **File Operations**: Use Electron IPC handlers
- **Error Handling**: Graceful degradation with fallbacks

---
*This mindmap serves as the single source of truth for understanding the LittleLLM codebase architecture and should be consulted before any development work.*
