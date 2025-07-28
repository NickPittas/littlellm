# Changelog

All notable changes to LittleLLM will be documented in this file.

## [3.1.0] - 2025-01-28

### 🚀 New Features
- **Enhanced Screenshot Functionality**: Complete overhaul of screenshot capture system
  - Full resolution capture (no longer limited to 1920x1080)
  - macOS screen recording permission handling with helpful error messages
  - Visual success/error notifications
  - Automatic file attachment to chat
  - Memory safety with 4K resolution cap
  - Comprehensive logging and debugging support

### 🔧 Improvements
- **Code Quality**: Resolved all ESLint warnings and TypeScript errors across the codebase
  - Fixed unused imports and variables
  - Proper TypeScript typing throughout
  - Improved React hooks dependency management
  - Better error handling patterns

- **Type Safety**: Enhanced TypeScript interfaces and type definitions
  - Proper service interface definitions
  - Eliminated `any` types where possible
  - Better type assertions and guards
  - Improved electron API type definitions

- **Performance**: Optimized React components
  - Proper useCallback usage to prevent unnecessary re-renders
  - Simplified useEffect dependencies
  - Better memory management

### 🐛 Bug Fixes
- Fixed screenshot button not working properly
- Resolved React hooks exhaustive-deps warnings
- Fixed unescaped entities in JSX
- Corrected service interface mismatches
- Fixed regex escape character issues
- Resolved variable hoisting problems

### 🛠️ Technical Improvements
- **Service Layer**: Improved service interfaces and implementations
  - Better DocumentParserService type definitions
  - Enhanced KnowledgeBaseService with proper interfaces
  - Improved chatService with correct typing
  - Fixed secureApiKeyService interface

- **Build System**: Enhanced build process
  - Better TypeScript compilation
  - Improved error handling during builds
  - Fixed type assertion issues

### 📝 Documentation
- Added comprehensive screenshot testing functionality
- Improved code comments and documentation
- Better error messages and user feedback

### 🔒 Security
- Enhanced type safety reduces potential runtime errors
- Better service interface validation
- Improved error handling prevents information leakage

---

## [3.0.0] - Previous Release
- Initial modern UI implementation
- Core chat functionality
- MCP server integration
- Knowledge base features
- Multi-provider support

---

## How to Test Screenshot Functionality

1. **Manual Testing**: Click the camera icon in the bottom input area
2. **Console Testing**: Run `window.testScreenshotFunctionality()` in browser DevTools
3. **Debug Testing**: Run `window.testScreenshot()` for detailed logging

### macOS Users
If screenshot fails, ensure screen recording permission is granted:
1. Go to System Preferences > Security & Privacy > Privacy > Screen Recording
2. Add LittleLLM to the allowed applications
3. Restart the application

### Troubleshooting
- Check browser console for detailed error messages
- Look for success/error notifications in top-right corner
- Verify screenshots appear as attached files in chat
- Check main process logs for backend errors
