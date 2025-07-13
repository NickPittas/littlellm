# LittleLLM Project Mindmap & Architecture Guide

## 🏗️ Project Overview
LittleLLM is an Electron-based desktop AI chat application built with Next.js, React, and TypeScript. It provides a native Windows experience for AI conversations with multiple providers.

**Current Version: 1.7.0**
**Release Date: January 2025**

### Version 1.7.0 Key Features
- **Enhanced Vision Support**: Fixed Ollama vision models with native API integration
- **Improved n8n Integration**: Proper multipart/form-data image handling and response parsing
- **Advanced Response Parsing**: Automatic cleanup of XML tags and structured responses
- **Comprehensive Debugging**: Enhanced settings save/reload with detailed logging
- **Image Processing Optimization**: Removed unnecessary image conversion for all APIs

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
  - **NEW**: Reset chat button for clearing conversations
  - **NEW**: MCP servers dropdown with enable/disable toggles
  - **NEW**: Token usage display (tokens/s and total tokens)

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
  - **NEW**: MCP servers management section
  - **NEW**: Raw MCP configuration editor
  - **NEW**: Enable/disable MCP servers globally

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
- **NEW**: `provider-dropdown.tsx` - Provider selection with logos
- **NEW**: `mcp-dropdown.tsx` - MCP servers management dropdown
- `floating-dropdown.tsx` - Generic floating dropdown wrapper

## 🎨 UI Architecture & Styling Guide

### Dropdown System Architecture
LittleLLM uses a dual-dropdown system:
1. **Electron Native Dropdowns**: Floating windows for better positioning and theming
2. **Fallback Web Dropdowns**: Standard React dropdowns for non-Electron environments

### Dropdown Components & Their Responsibilities

#### 1. **Electron Main Process Dropdown (`electron/main.ts`)**
- **Location**: Lines 1672-1991 in `electron/main.ts`
- **Purpose**: Creates native floating windows for dropdowns
- **Styling**: Inline CSS with CSS variables from main window
- **Scrollbar Hiding**:
  - `.dropdown-container` (lines 1820-1824)
  - `.dropdown-content` (lines 1850-1854)
- **Height Configuration**:
  - Default max-height: 200px (line 1845)
  - Positioning logic: Lines 1709-1736

#### 2. **Provider Dropdown (`src/components/ui/provider-dropdown.tsx`)**
- **Electron Height**: Lines 65-75 (maxHeight: 400px)
- **Fallback Height**: Lines 187-199 (maxHeight: 400px)
- **Scrollbar Hiding**:
  - Electron HTML: Lines 291-300
  - Fallback CSS: Lines 193-199
- **Positioning**: Lines 80-84 (rect.left, rect.bottom + 4px)

#### 3. **MCP Dropdown (`src/components/ui/mcp-dropdown.tsx`)**
- **Height Configuration**: Lines 291-296 (maxHeight: 415px - INCREASED BY 15PX)
- **Scrollbar Hiding**: Lines 249-269 (comprehensive scrollbar removal)
- **Positioning**: Lines 306-310 (rect.left, rect.bottom + 4px)

#### 4. **Electron Dropdown (`src/components/ui/electron-dropdown.tsx`)**
- **Height Configuration**: Line 66 (Math.min(300, filteredOptions.length * 40 + 80))
- **Positioning**: Lines 70-74 (rect.left, rect.bottom + 4px)

### Critical Styling Locations for UI Changes

#### **Scrollbar Hiding Requirements:**
1. **Electron Main Process** (`electron/main.ts`) - ✅ FIXED:
   - `.dropdown-container` (lines 1820-1824) - scrollbar-width: none
   - `.dropdown-content` (lines 1850-1854) - scrollbar-width: none
   - **CRITICAL**: Custom scrollbar styles (lines 1893-1905) - REPLACED with display: none
   - **CRITICAL**: Body/HTML overflow (lines 1803-1817) - ADDED overflow: hidden

2. **Provider Dropdown** (`provider-dropdown.tsx`):
   - Electron HTML generation (lines 291-300) ✅ IMPLEMENTED
   - Fallback CSS (lines 193-199) ✅ IMPLEMENTED

3. **MCP Dropdown** (`mcp-dropdown.tsx`):
   - HTML generation (lines 249-269) ✅ IMPLEMENTED

4. **Global CSS** (`src/app/globals.css`):
   - Radix UI dropdowns (lines 105-124) ✅ IMPLEMENTED

#### **Height Configuration Requirements:**
1. **Window Minimum Height** (`electron/main.ts`):
   - Main window minHeight: Line 767 (157px) ✅ IMPLEMENTED
   - Default height: Line 761 (157px) ✅ IMPLEMENTED

2. **Dropdown Window Height** (`electron/main.ts`) - ✅ FIXED:
   - **CRITICAL**: BrowserWindow height (line 1752) - ADDED +15px to height parameter
   - Dropdown content max-height (line 1844) - INCREASED to 215px

3. **MCP Dropdown Height** (`mcp-dropdown.tsx`):
   - maxHeight: Line 296 (415px) ✅ IMPLEMENTED

4. **Provider Dropdown Height** (`provider-dropdown.tsx`):
   - maxHeight: Line 69 (415px) ✅ IMPLEMENTED
   - Fallback maxHeight: Line 187 (415px) ✅ IMPLEMENTED

5. **Electron Dropdown Height** (`electron-dropdown.tsx`):
   - Dynamic height: Line 66 (315px) ✅ IMPLEMENTED

#### **Positioning Requirements:**
1. **All Dropdowns**: Should position at cursor location
2. **CRITICAL FIX** (`electron/main.ts` lines 1709-1730):
   - **ISSUE**: Manual coordinate math with getBoundingClientRect() was unreliable
   - **FIXED**: Using Electron's `screen.getCursorScreenPoint()` for direct cursor positioning
   - **REASON**: Built-in Electron API is more reliable than manual coordinate calculations
3. **Window Anchoring** (`electron/main.ts` line 1745):
   - **ADDED**: `parent: mainWindow` to anchor dropdown to main window
4. **Debug Location**: `electron/main.ts` lines 1721-1730 (cursor positioning debug logs)

#### `/src/services` - Business Logic Layer

**Core Services:**

- `llmService.ts` - **LLM PROVIDER MANAGEMENT & UNIVERSAL TOOL CALLING**
  - Manages 10 AI providers: OpenAI, Anthropic, Gemini, Mistral, DeepSeek, LMStudio, Ollama, OpenRouter, Requesty, Replicate
  - Dynamic model fetching with caching
  - Provider-specific API implementations
  - Streaming response handling
  - Vision model support detection
  - **TOOL CALLING SYSTEM**:
    - **Structured Tool Calling**: Native support for tool-capable models (OpenAI, Anthropic, etc.)
    - **Tool Calling Toggle**: User-controlled enable/disable toggle next to attachment buttons
    - **Streaming Tool Assembly**: Assembles tool calls from streaming chunks
    - **Clean Follow-up Calls**: Processes tool results without system message pollution
    - **Cross-Provider Compatibility**: Works with ALL models regardless of native tool support
  - **MCP TOOLS INTEGRATION**:
    - Full MCP tools integration for all providers
    - Tool call execution and response handling
    - Provider-specific tool formatting
    - Tool result processing and natural language responses
  - **TOKEN USAGE TRACKING**: Real-time token counting and display

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

- **NEW**: `mcpService.ts` - **MODEL CONTEXT PROTOCOL (MCP) INTEGRATION**
  - MCP server management and configuration
  - Tool discovery and execution via IPC
  - Resource access and prompt management
  - Connection status tracking
  - Renderer-to-main process communication bridge

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
- **IPC Handlers**: 60+ handlers for frontend-backend communication
- **System Integration**: Global shortcuts, tray icon, clipboard access
- **File System**: Settings and conversation file management
- **Screenshot Capture**: Desktop screenshot functionality
- **Port Detection**: Automatic Next.js dev server detection
- **NEW**: MCP server management and SDK integration
- **NEW**: MCP tool execution and resource access
- **NEW**: MCP configuration file handling (mcp.json)

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
- **NEW**: **Reset Chat Button** (🔄): Clear current conversation and start fresh
- **NEW**: **MCP Servers Button** (🖥️): Toggle MCP servers on/off per chat
- **Settings Button** (⚙️): Open settings overlay
- **History Button** (📚): Access conversation history
- **NEW**: **Token Display**: Shows tokens/s and total tokens used

### Action Menu (Ctrl+Shift+Space)
- **Prompt Selection**: Quick access to categorized prompts
- **Clipboard Integration**: Auto-replace `{content}` with clipboard text
- **Fuzzy Search**: Find prompts quickly

### Message Features
- **Thinking Sections**: Collapsible `<think>` tag content
- **Copy Buttons**: Copy individual messages or parts
- **Text Selection**: Select and copy portions of responses
- **Streaming Display**: Real-time response rendering
- **NEW**: **Tool Execution**: MCP tools automatically executed and results displayed
- **NEW**: **Token Metrics**: Real-time tokens/second and total usage tracking

### Window Controls
- **Auto-Resize**: Window expands when chat starts
- **Draggable**: Click anywhere to drag window
- **Always On Top**: Stays above other applications
- **Transparent Background**: Floating window appearance

### NEW: MCP (Model Context Protocol) Features
- **Server Management**: Add, edit, delete, and configure MCP servers
- **Tool Integration**: Automatic tool discovery and execution
- **Per-Chat Control**: Enable/disable servers per conversation
- **Raw Config Editor**: Direct JSON configuration editing
- **Connection Status**: Real-time server connection monitoring
- **IPC Architecture**: Secure main-process execution with renderer UI

## 🔧 Technical Implementation Details

### Tool Calling Architecture

#### **Core Philosophy: "Native Tool Support with User Control"**
LittleLLM implements a tool calling system that works with models that natively support structured tool calling, with a user-controlled toggle to enable/disable tool functionality.

#### **Tool Calling Strategy:**

**Native Structured Tool Calling**
- **Models**: OpenAI (gpt-4o, gpt-4-turbo), Anthropic (Claude), OpenRouter tool-capable models
- **Method**: Standard OpenAI-compatible tool calling API
- **Implementation**: Direct tool parameter passing, streaming tool call assembly
- **User Control**: Toggle switch next to attachment buttons to enable/disable tool calling
- **Advantages**: Fastest, most reliable, native model support
**When Tool Calling is Disabled:**
- **Behavior**: Messages sent without any tool calling capabilities
- **Implementation**: MCP tools are not fetched or included in requests
- **User Experience**: Standard chat functionality without tool integration

#### **Tool Execution Flow (When Enabled)**
```
1. User Request → "weather in athens greece today"
2. Model Response → Tool suggestion (structured format)
3. Tool Detection → Parse tool calls from response
4. Tool Execution → Execute MCP tools with arguments
5. Follow-up Call → Send tool results back to model (clean context)
6. Final Response → Natural language answer with tool data
```

#### **Key Technical Features:**

**User-Controlled Tool Calling:**
- Toggle switch next to attachment and screenshot buttons
- Enables/disables tool calling functionality per user preference
- Persists setting across app restarts

**Clean Follow-up Context:**
- Removes verbose system messages from follow-up calls
- Prevents context pollution that confuses models
- Maintains conversation flow integrity

**Streaming Tool Assembly:**
- Assembles tool calls from streaming chunks (OpenAI)
- Handles partial tool arguments across multiple chunks
- Maintains tool call integrity during streaming

### Provider Architecture
Each provider implements standardized interface:
- `fetchModels()` - Dynamic model discovery
- `sendMessage()` - Chat completion with streaming
- `supportsVision()` - Image capability detection
- Error handling and fallback mechanisms
- **UNIVERSAL TOOL INTEGRATION**:
  - `getMCPToolsForProvider()` - Format MCP tools for provider APIs
  - `executeMCPTool()` - Execute tools and handle responses
  - `detectTextBasedToolCalls()` - Parse tool suggestions from text
  - `executeToolsAndGetFollowUp()` - Process tool results with clean context
  - Tool call parsing and result integration across all model types

**NEW v1.7 - Enhanced Vision & Response Processing:**
- **Native API Support**: Ollama vision models use native `/api/chat` endpoint
- **No Image Conversion**: Direct base64 handling for all providers (no unnecessary processing)
- **Multipart Form Data**: n8n provider sends images as proper binary attachments
- **Response Parser**: Automatic cleanup of XML tags, JSON arrays, and structured responses
- **Dual API Handling**: Ollama switches between native and OpenAI-compatible APIs based on content type

### Storage Strategy
- **Settings**: Single JSON file with nested provider configs
- **Conversations**: Individual JSON files per conversation
- **Prompts**: Static JSON + custom additions
- **Cache**: In-memory model lists with TTL
- **NEW**: **MCP Servers**: mcp.json file for server configurations
- **NEW**: **Token Tracking**: Session-based token usage persistence

### Security Model
- **Context Isolation**: Electron security best practices
- **API Key Storage**: Local JSON files only
- **No Network Exposure**: All APIs called from main process
- **File Validation**: Strict file type checking
- **NEW**: **MCP Isolation**: MCP SDK runs only in main process
- **NEW**: **IPC Security**: Secure communication bridge for MCP operations

### Performance Optimizations
- **Model Caching**: 5-minute TTL for provider models
- **Lazy Loading**: Components load on demand
- **Streaming**: Real-time response display
- **Memory Management**: Conversation history limits

## 🚨 Critical Dependencies & Relationships

### Component Dependencies
- `VoilaInterface` → All other components (root orchestrator)
- `ChatInterface` → `MessageWithThinking`, `UserMessage`
- `BottomToolbar` → `llmService`, `settingsService`, **NEW**: `mcpService`
- **NEW**: `MCPDropdown` → `mcpService`, Electron IPC
- **NEW**: `SettingsOverlay` → `mcpService` for MCP management
- All components → UI component library

### Service Dependencies
- `chatService` → `llmService`, `conversationHistoryService`
- `llmService` → Provider-specific implementations, **NEW**: `mcpService`
- `settingsService` → Electron IPC for file operations
- `promptsService` → Static data + storage service
- **NEW**: `mcpService` → Electron IPC bridge, MCP SDK (main process)

### Critical Files for Functionality
- `llmService.ts` - Core AI provider logic, **NEW**: MCP tool integration
- `main.ts` - Electron application lifecycle, **NEW**: MCP SDK hosting
- `VoilaInterface.tsx` - Main UI orchestration
- `settingsService.ts` - Configuration persistence
- **NEW**: `mcpService.ts` - MCP server management and IPC bridge
- **NEW**: `mcp-dropdown.tsx` - MCP server UI controls
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
5. **NEW**: **Test MCP integration** after tool-related changes

### Common Patterns
- **Settings Changes**: Always go through `settingsService`
- **Provider Operations**: Route through `llmService`
- **UI State**: Use React hooks and context
- **File Operations**: Use Electron IPC handlers
- **MCP Operations**: Use `mcpService` IPC bridge pattern
- **Tool Integration**: Format tools per provider in `llmService`
- **UNIVERSAL TOOL CALLING PATTERNS**:
  - **Error Detection**: Check for "tools not supported" in API responses
  - **Automatic Retry**: Remove tools parameter and add text instructions
  - **Tool Name Correction**: Use `correctToolName()` for name variations
  - **Text Parsing**: Use `detectTextBasedToolCalls()` for non-tool models
  - **Clean Follow-up**: Filter system messages in follow-up calls
  - **Tool Execution**: Always use `executeMCPTool()` for consistency

## 🔧 Tool Calling Implementation Guide

### For Developers: How to Add Tool Support to New Providers

#### **Step 1: Provider Detection**
```typescript
// In llmService.ts - Add provider to tool-capable list
const toolCapableProviders = ['openai', 'anthropic', 'openrouter', 'requesty', 'your-new-provider'];
```

#### **Step 2: Tool Formatting**
```typescript
// Add provider-specific tool formatting
private formatToolsForProvider(tools: any[], provider: string): any[] {
  switch (provider) {
    case 'your-new-provider':
      return tools.map(tool => ({
        // Your provider's specific tool format
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }));
    default:
      return this.formatToolsForOpenAI(tools); // Fallback to OpenAI format
  }
}
```

#### **Step 3: Error Handling**
```typescript
// Add error detection for your provider
if (!response.ok) {
  const error = await response.text();

  // Check if provider doesn't support tools
  if (error.includes('tools not supported') || error.includes('your-provider-specific-error')) {
    // Implement text-based fallback
    return this.handleTextBasedToolFallback(messages, settings, mcpTools);
  }
}
```

#### **Step 4: Tool Call Detection**
```typescript
// For streaming responses, detect tool calls
if (parsed.choices?.[0]?.delta?.tool_calls) {
  // Assemble tool calls from streaming chunks
  this.assembleToolCalls(parsed.choices[0].delta.tool_calls);
}

// For text-based responses, parse JSON
const detectedTools = this.detectTextBasedToolCalls(responseContent, mcpTools);
```

### Critical Implementation Files

#### **llmService.ts - Key Functions:**
- `detectTextBasedToolCalls()` - Lines 412-480: Parses JSON tool suggestions from text
- `correctToolName()` - Lines 421-460: Fixes tool name variations
- `executeToolsAndGetFollowUp()` - Lines 542-620: Processes tool results with clean context
- `handleStreamResponse()` - Lines 3897-4020: Assembles streaming tool calls
- Provider-specific error handling in each `send[Provider]Message()` function

#### **Tool Call Flow Locations:**
1. **Initial Request**: Provider-specific `send[Provider]Message()` functions
2. **Error Detection**: Error handling blocks in each provider function
3. **Text Fallback**: Retry logic with text-based instructions
4. **Tool Detection**: `detectTextBasedToolCalls()` for parsing responses
5. **Tool Execution**: `executeMCPTool()` via MCP service
6. **Follow-up Processing**: `executeToolsAndGetFollowUp()` for clean context
7. **Final Response**: Combined tool results with natural language

---

## 🆕 Recent Updates (Latest Implementation)

### 🚀 Tool Calling System with User Control
- **User-Controlled Tool Calling**: Toggle switch next to attachment buttons for enable/disable
- **Native Tool Support**: Works with models that natively support structured tool calling
- **Streaming Tool Assembly**: Assembles tool calls from streaming chunks for OpenAI
- **Clean Follow-up Processing**: Tool results processed without system message pollution
- **Settings Persistence**: Tool calling preference saved across app restarts
- **Provider Support**: Works with OpenAI, Anthropic, and other tool-capable providers

### 🔧 Tool Calling Technical Achievements
- **OpenAI Structured Tools**: Full streaming tool call support with proper format conversion
- **Toggle Integration**: Seamless enable/disable without breaking existing functionality
- **Settings Management**: Tool calling state integrated into settings service
- **Tool Result Integration**: Seamless integration of tool results into natural responses
- **Provider-Specific Formatting**: Each provider gets properly formatted tool calls

### 🎯 MCP (Model Context Protocol) Integration
- **Full MCP SDK Integration**: Complete implementation of Model Context Protocol
- **Universal Tool Execution**: MCP tools work with ALL models via universal system
- **Server Management**: Add, configure, and manage MCP servers through UI
- **Per-Chat Control**: Enable/disable MCP servers per conversation
- **Security Architecture**: MCP SDK isolated in main process with IPC bridge
- **Tool Discovery**: Automatic detection and formatting of available MCP tools

### 🎨 Enhanced UI Features
- **Token Tracking**: Real-time tokens/second and total usage display
- **Reset Chat**: One-click conversation clearing
- **MCP Dropdown**: Bottom toolbar control for MCP server management
- **Settings Panel**: Dedicated MCP configuration section with raw JSON editor
- **Tool Call Indicators**: Visual feedback when tools are being executed
- **Streaming Improvements**: Better handling of tool calls in streaming responses

### 🔗 Provider Enhancements
- **Tool-Capable Provider Support**: Native tool calling for providers that support it
- **OpenAI**: Full streaming tool call support with proper format conversion
- **Anthropic**: Native tool calling with proper formatting
- **Token Limits**: Proper max_tokens handling for all Claude models
- **User Control**: Tool calling can be enabled/disabled per user preference

### 🏗️ Architecture Improvements
- **Tool Calling Toggle**: User-controlled enable/disable functionality
- **Clean Context Management**: Prevents system message pollution in follow-up calls
- **IPC Bridge**: Secure communication between renderer and main process for MCP
- **Service Layer**: Clean separation of concerns with dedicated MCP service
- **Type Safety**: Full TypeScript support for all tool operations
- **Settings Integration**: Tool calling preference integrated into settings system

### 🎉 User Experience Improvements
- **User Control**: Toggle switch for enabling/disabling tool calling
- **Visual Feedback**: Clear indication of tool calling status through UI
- **Settings Persistence**: Tool calling preference saved across app sessions
- **Real-time Feedback**: Clear indication of tool execution and results
- **Simplified Architecture**: Removed complex text-based tool fallback system

---

## 📋 Version 1.7.0 Changelog (January 2025)

### 🖼️ Vision Model Fixes
- **Fixed Ollama Vision Support**: Proper pattern matching for vision models (llama3.2-vision, llava, etc.)
- **Native API Integration**: Ollama vision models now use native `/api/chat` endpoint instead of OpenAI-compatible
- **Dual Response Handling**: Support for both native Ollama and OpenAI-compatible response formats
- **Image Processing Optimization**: Removed unnecessary image conversion - all APIs now receive original image data

### 🔗 n8n Integration Improvements
- **Multipart Form Data**: Images now sent as proper binary attachments instead of JSON
- **POST Request Fix**: All n8n requests now use POST method (was incorrectly using GET for text-only)
- **Response Parser**: Advanced parsing system for cleaning up structured responses
- **XML Tag Removal**: Automatic cleanup of `<Simple>`, `<Complex>` and other XML-like tags
- **JSON Array Handling**: Proper extraction from responses like `[{"output":"content"}]`

### 🛠️ Response Processing Engine
- **ResponseParser Class**: Comprehensive utility for cleaning structured responses
- **Multi-Format Support**: Handles JSON arrays, objects, XML tags, and mixed formats
- **Field Detection**: Automatically extracts from `output`, `response`, `message`, `content`, `text`, `result` fields
- **Fallback Safety**: Always falls back to original response if parsing fails
- **Debug Logging**: Detailed console output for troubleshooting response issues

### 🔧 Settings & Debugging
- **Enhanced Logging**: Comprehensive debug output for settings save/reload operations
- **Electron API Validation**: Detailed checks for API availability and function existence
- **Settings Structure Logging**: Full JSON output for troubleshooting configuration issues
- **Listener Tracking**: Monitor how many components are listening to settings changes
- **Force Update Method**: Improved settings reload with proper listener notification

### 🏗️ Technical Improvements
- **Image Format Preservation**: No more unnecessary base64 conversion or image optimization
- **API Endpoint Selection**: Smart switching between native and compatible APIs based on content
- **Error Handling**: Better error messages and fallback mechanisms
- **Type Safety**: Improved TypeScript definitions for response parsing
- **Performance**: Reduced image processing overhead for all providers

### 🐛 Bug Fixes
- Fixed vision model detection for Ollama providers
- Resolved n8n webhook 404 errors (GET vs POST method)
- Corrected image data format for multipart uploads
- Fixed settings persistence issues with detailed debugging
- Improved response parsing for wrapped/structured content

---
*This mindmap serves as the single source of truth for understanding the LittleLLM codebase architecture and should be consulted before any development work.*
