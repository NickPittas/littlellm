# Developer Documentation

This document provides comprehensive information about the LittleLLM codebase architecture, development setup, and contribution guidelines.

## 🏗️ Architecture Overview

LittleLLM is built as an Electron desktop application with a Next.js frontend, providing a native Windows experience for AI chat interactions.

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Desktop**: Electron 37
- **Styling**: Tailwind CSS, Radix UI components
- **Build**: Electron Builder for distribution
- **State Management**: React hooks and context
- **File Storage**: JSON files for settings and conversations

### Project Structure
```
littlellm/
├── src/                    # Frontend source code
│   ├── app/               # Next.js app router
│   ├── components/        # React components
│   ├── services/          # Business logic services
│   ├── contexts/          # React contexts
│   ├── lib/              # Utility libraries
│   └── utils/            # Helper functions
├── electron/             # Electron main process
├── assets/              # Icons and static assets
├── dist/                # Build output
└── scripts/             # Build and utility scripts
```

## 🧩 Component Architecture

### Core Components

#### VoilaInterface
- **Purpose**: Main chat interface component
- **Features**: Message display, input handling, file attachments
- **Key Files**: `src/components/VoilaInterface.tsx`

#### MessageWithThinking
- **Purpose**: Renders AI responses with collapsible thinking sections
- **Features**: Parses `<think>` tags, copy functionality
- **Key Files**: `src/components/MessageWithThinking.tsx`

#### UserMessage
- **Purpose**: Renders user messages with copy functionality
- **Features**: Text selection, copy button
- **Key Files**: `src/components/UserMessage.tsx`

#### BottomToolbarNew
- **Purpose**: Provider/model selection and file upload
- **Features**: Model persistence, dynamic model fetching
- **Key Files**: `src/components/BottomToolbarNew.tsx`

#### ActionMenuOverlay
- **Purpose**: Quick actions and prompt selection
- **Features**: Clipboard integration, prompt processing
- **Key Files**: `src/components/ActionMenuOverlay.tsx`

#### SettingsOverlay
- **Purpose**: Application configuration interface
- **Features**: API key management, theme selection
- **Key Files**: `src/components/SettingsOverlay.tsx`

### UI Components
Located in `src/components/ui/`, these are reusable components built on Radix UI:
- `button.tsx` - Button component
- `dialog.tsx` - Modal dialogs
- `select.tsx` - Dropdown selectors
- `electron-dropdown.tsx` - Custom dropdown for Electron

## 🔧 Services Architecture

### ChatService (`src/services/chatService.ts`)
- **Purpose**: Handles AI provider communication
- **Features**: Multi-provider support, file processing, streaming
- **Key Methods**:
  - `sendMessage()` - Send messages to AI providers
  - `processFiles()` - Handle file attachments
  - `getAvailableModels()` - Fetch provider models

### SettingsService (`src/services/settingsService.ts`)
- **Purpose**: Manages application settings and persistence
- **Features**: JSON file storage, real-time updates
- **Key Methods**:
  - `getSettings()` - Retrieve current settings
  - `updateSettings()` - Update and save settings
  - `saveSettingsToDisk()` - Persist to JSON file

### PromptsService (`src/services/promptsService.ts`)
- **Purpose**: Manages prompt templates and processing
- **Features**: Custom prompts, clipboard integration
- **Key Methods**:
  - `getAllPrompts()` - Get all available prompts
  - `processPrompt()` - Replace placeholders with content
  - `addCustomPrompt()` - Create new prompt templates

### ConversationHistoryService (`src/services/conversationHistoryService.ts`)
- **Purpose**: Manages chat history and persistence
- **Features**: Individual JSON files per conversation
- **Key Methods**:
  - `createNewConversation()` - Start new chat
  - `updateConversation()` - Save chat updates
  - `loadConversations()` - Retrieve chat history

### LLMService (`src/services/llmService.ts`)
- **Purpose**: Low-level AI provider communication
- **Features**: HTTP requests, streaming, error handling
- **Key Methods**:
  - `sendMessage()` - Direct provider communication
  - `handleStreaming()` - Process streaming responses

## 🖥️ Electron Architecture

### Main Process (`electron/main.ts`)
- **Window Management**: Creates and manages application windows
- **IPC Handlers**: Handles communication between main and renderer
- **System Integration**: Tray icon, global shortcuts, file system
- **Settings Storage**: JSON file persistence

### Preload Script (`electron/preload.ts`)
- **API Exposure**: Safely exposes Electron APIs to renderer
- **Security**: Maintains context isolation
- **IPC Bridge**: Facilitates main-renderer communication

### Key IPC Channels
- `read-clipboard` / `write-clipboard` - Clipboard operations
- `get-settings` / `update-app-settings` - Settings management
- `open-action-menu` / `close-action-menu` - Overlay windows
- `save-conversation-*` - Chat history persistence

## 🎨 Theming System

### ThemeContext (`src/contexts/ThemeContext.tsx`)
- **Purpose**: Manages application themes
- **Features**: Multiple dark themes, real-time switching
- **Themes**: Dark Slate, Dark Blue, Dark Purple, etc.

### Theme Implementation
- **CSS Variables**: Dynamic theme switching via CSS custom properties
- **Tailwind Integration**: Theme-aware utility classes
- **Persistence**: Theme selection saved to settings

## 📁 Data Storage

### Settings Storage
- **Location**: `%APPDATA%/littlellm/voila-settings.json`
- **Format**: JSON with nested structure
- **Content**: API keys, UI preferences, provider settings

### Conversation Storage
- **Location**: `%APPDATA%/littlellm/conversations/`
- **Format**: Individual JSON files per conversation
- **Index**: `index.json` contains conversation metadata

### Prompt Storage
- **Location**: `%APPDATA%/littlellm/custom-prompts.json`
- **Format**: JSON array of prompt objects
- **Built-in**: Default prompts in `src/data/prompts.json`

## 🔄 Key Features Implementation

### Model Persistence
1. **Selection**: User selects model in BottomToolbarNew
2. **Storage**: Model saved to `providers[providerId].lastSelectedModel`
3. **Auto-save**: Settings automatically saved to disk
4. **Restoration**: On provider switch, last model is restored

### Thinking Sections
1. **Parsing**: MessageWithThinking parses `<think>` tags
2. **Extraction**: Thinking content extracted and removed from response
3. **Display**: Collapsible sections with brain icon
4. **Interaction**: Click to expand/collapse thinking

### Clipboard Integration
1. **Detection**: Prompts with `{content}` placeholder detected
2. **Reading**: Clipboard content read via Electron API
3. **Replacement**: `{content}` replaced with clipboard text
4. **Processing**: Enhanced prompts sent to AI provider

### Copy Functionality
1. **Hover**: Copy button appears on message hover
2. **Full Copy**: Entire message (including thinking) copied
3. **Partial Copy**: Text selection enabled for partial copying
4. **Feedback**: Visual confirmation with checkmark

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Windows 10/11 (for Windows builds)

### Installation
```bash
git clone https://github.com/your-repo/littlellm.git
cd littlellm
npm install
```

### Development Commands
```bash
# Start development server
npm run dev

# Start Electron in development
npm run electron-dev

# Build for production
npm run build

# Build Electron executable
npm run build-electron

# Create Windows installer
npm run dist:win-installer

# Create Windows portable
npm run dist:win-portable
```

### Development Workflow
1. **Frontend Changes**: Use `npm run dev` for hot reload
2. **Electron Changes**: Restart with `npm run electron-dev`
3. **Testing**: Manual testing with different providers
4. **Building**: Test builds before release

## 🧪 Testing Strategy

### Manual Testing
- **Provider Testing**: Test all AI providers with various models
- **File Upload**: Test different file types and sizes
- **UI Interactions**: Test all buttons, dropdowns, and dialogs
- **Settings**: Verify persistence across restarts

### Build Testing
- **Installer**: Test installation and uninstallation
- **Portable**: Test on clean systems without installation
- **Upgrades**: Test upgrade scenarios

## 📦 Build Process

### Production Build Steps
1. **Frontend Build**: `next build` creates optimized React app
2. **Electron Build**: TypeScript compilation for main process
3. **Packaging**: Electron Builder packages application
4. **Distribution**: Creates installer and portable versions

### Build Configuration
- **electron-builder.json**: Main build configuration
- **package.json**: Scripts and dependencies
- **tsconfig.json**: TypeScript configuration

## 🔒 Security Considerations

### API Key Storage
- **Local Only**: API keys stored locally, never transmitted
- **Encryption**: Consider implementing encryption for sensitive data
- **Validation**: Input validation for all user data

### Electron Security
- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Preload Scripts**: Safe API exposure

## 🚀 Deployment

### Release Process
1. **Version Update**: Update version in package.json
2. **Documentation**: Update README and changelogs
3. **Build**: Create Windows installer and portable
4. **Testing**: Test on clean Windows systems
5. **Release**: Upload to GitHub releases

### Distribution Files
- `LittleLLM-Setup-1.5.0.exe` - Windows installer
- `LittleLLM-Portable-1.5.0.exe` - Portable executable
- Documentation and license files

## 🤝 Contributing

### Code Style
- **TypeScript**: Strict typing required
- **React**: Functional components with hooks
- **Formatting**: Prettier for code formatting
- **Linting**: ESLint for code quality

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request

### Issue Reporting
- Use GitHub issues for bugs and features
- Provide detailed reproduction steps
- Include system information and logs

---

For more information, see the main [README](README.md) and [API Setup Guide](API_SETUP.md).
