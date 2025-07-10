# LittleLLM v1.5.0 Release Notes

**Release Date**: December 2024  
**Build**: Windows Desktop Application

## 🎉 What's New in v1.5

### ✨ Major Features

#### 🧠 Model Persistence Per Provider
- **Each provider remembers your last selected model** across app restarts
- **Automatic saving** when you switch models
- **Seamless experience** - no need to reselect models every time
- **Works across all providers**: OpenAI, Anthropic, Gemini, Mistral, DeepSeek, LM Studio, Ollama, OpenRouter, Replicate, etc.

#### 🤔 Thinking Sections Display
- **AI reasoning visualization** - see how models think through problems
- **Collapsible sections** for `<think>` tags in responses
- **Multiple thinking blocks** supported in single responses
- **Clean separation** between thinking and final answers
- **Brain icon indicator** for easy identification

#### 📋 Enhanced Clipboard Integration
- **Automatic content insertion** - prompts with `{content}` placeholder automatically include clipboard text
- **Built-in action prompts** now use clipboard integration:
  - Summarize Text
  - Explain Code
  - Translate Text
  - Improve Writing
  - Brainstorm Ideas
- **Smart processing** - only replaces `{content}` when clipboard has content

#### 📄 Copy Functionality
- **One-click copy** - hover over any message to reveal copy button
- **Full message copying** - includes thinking sections and complete content
- **Partial text selection** - select and copy specific parts of responses
- **Visual feedback** - green checkmark confirms successful copying
- **Works everywhere** - user messages, AI responses, and thinking sections

#### 🌐 Expanded Provider Support
- **Anthropic Claude** - Access to Claude 3.5 Sonnet, Opus, Sonnet, and Haiku models
- **Google Gemini** - Gemini 1.5 Pro and Flash models with multimodal capabilities
- **Mistral AI** - European AI with Mistral Large, Medium, Small, and Codestral
- **DeepSeek** - Cost-effective models including DeepSeek Chat and Coder
- **LM Studio** - Local server support for any GGUF model (completely free)
- **Enhanced local support** - Better integration with Ollama and LM Studio
- **Unified API handling** - Consistent experience across all providers
- **Dynamic model fetching** - Automatically discover available models per provider

### 🔧 Technical Improvements

#### Enhanced User Interface
- **Improved message bubbles** with better styling and spacing
- **Hover effects** for interactive elements
- **Better text selection** with proper cursor behavior
- **Optimized scrolling** in dropdowns and chat areas
- **Consistent theming** across all components

#### Performance Optimizations
- **Faster model switching** with cached selections
- **Improved dropdown rendering** with better scroll handling
- **Optimized file processing** for attachments
- **Reduced memory usage** in chat history

#### Code Quality
- **Removed unused components** and dependencies
- **Cleaned up imports** and dead code
- **Better error handling** throughout the application
- **Improved TypeScript types** for better development experience

## 📦 Distribution Packages

### Windows Installer (`LittleLLM-Setup-1.5.0.exe`)
- **Full installation** with Start Menu and Desktop shortcuts
- **Automatic updates** support (future releases)
- **Uninstaller** included
- **File associations** for supported file types
- **Recommended for most users**

### Portable Version (`LittleLLM-Portable-1.5.0.exe`)
- **No installation required** - run directly
- **Perfect for USB drives** or temporary usage
- **Settings stored** in same folder as executable
- **Ideal for testing** or restricted environments

## 🆕 New User Experience

### First-Time Setup
1. **Download and install** your preferred package
2. **Launch LittleLLM** from Start Menu or Desktop
3. **Configure API keys** in Settings (gear icon)
4. **Select provider and model** from bottom dropdowns
5. **Start chatting** immediately!

### Enhanced Workflow
1. **Copy text** you want to analyze (Ctrl+C)
2. **Open Action Menu** (Ctrl+Shift+Space)
3. **Select a prompt** - clipboard content automatically included
4. **View AI response** with optional thinking sections
5. **Copy results** with one-click or select specific text

## 🔄 Migration from v1.0

### Automatic Migration
- **Settings preserved** - all your API keys and preferences carry over
- **Chat history maintained** - previous conversations remain accessible
- **Custom prompts** automatically updated with new features
- **No manual steps required** - just install and run

### New Features Available Immediately
- **Model persistence** starts working with your first model selection
- **Copy buttons** appear on all existing and new messages
- **Thinking sections** display for any AI responses with `<think>` tags
- **Clipboard integration** works with existing and new prompts

## 🐛 Bug Fixes

### Resolved Issues
- **Fixed dropdown scrolling** issues with mouse wheel
- **Improved window resizing** behavior
- **Better error handling** for API failures
- **Resolved memory leaks** in chat history
- **Fixed file upload** edge cases
- **Improved theme switching** reliability

### Performance Fixes
- **Faster app startup** time
- **Reduced CPU usage** during idle
- **Better memory management** for long conversations
- **Optimized file processing** for large attachments

## ⚠️ Breaking Changes

### None!
- **Fully backward compatible** with v1.0 settings and data
- **No API changes** that affect existing functionality
- **Seamless upgrade** experience

## 🔧 System Requirements

### Minimum Requirements
- **Windows 10** (64-bit) or newer
- **4GB RAM** minimum
- **500MB free disk space**
- **Internet connection** (for cloud providers)

### Recommended
- **Windows 11** (64-bit)
- **8GB RAM** or more
- **1GB free disk space**
- **High-speed internet** for optimal performance

## 🛠️ Developer Changes

### Code Improvements
- **Removed unused dependencies**: FluentUI, cmdk, electron-store, zustand
- **Cleaned up components**: Removed ActionMenuPopup, CommandPalette, SettingsDialog
- **Better TypeScript types** throughout the codebase
- **Improved error handling** and logging

### Build System
- **Updated to v1.5.0** in all configuration files
- **Improved build scripts** for Windows distribution
- **Better artifact naming** for releases
- **Enhanced electron-builder** configuration

## 📚 Documentation Updates

### New Documentation
- **Comprehensive README** with v1.5 features
- **API Setup Guide** for all supported providers
- **Developer Documentation** with architecture details
- **Release Notes** (this document)

### Updated Guides
- **Installation instructions** for both installer and portable
- **Feature documentation** with screenshots and examples
- **Troubleshooting guide** with common issues and solutions
- **Keyboard shortcuts** reference

## 🔮 What's Next

### Planned Features (v1.6+)
- **Custom themes** creation and sharing
- **Plugin system** for extending functionality
- **Voice input/output** support
- **Advanced file processing** (OCR, document parsing)
- **Conversation search** and filtering
- **Export/import** functionality

### Community Features
- **Prompt sharing** marketplace
- **Community themes** and customizations
- **Integration guides** for popular workflows
- **Video tutorials** and documentation

## 🙏 Acknowledgments

### Contributors
- **Development Team** - Core feature implementation
- **Beta Testers** - Feedback and bug reports
- **Community** - Feature requests and suggestions

### Open Source Libraries
- **Electron** - Desktop application framework
- **Next.js** - React framework
- **Radix UI** - Component library
- **Tailwind CSS** - Styling framework
- **Lucide Icons** - Icon library

## 📞 Support

### Getting Help
- **Documentation**: README.md and API_SETUP.md
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@littlellm.com

### Reporting Bugs
1. **Check existing issues** first
2. **Provide detailed steps** to reproduce
3. **Include system information** and logs
4. **Attach screenshots** if relevant

---

**Download LittleLLM v1.5.0 today and experience the next level of AI chat interaction!**

🔗 **Download Links**:
- [Windows Installer](https://github.com/your-repo/releases/download/v1.5.0/LittleLLM-Setup-1.5.0.exe)
- [Windows Portable](https://github.com/your-repo/releases/download/v1.5.0/LittleLLM-Portable-1.5.0.exe)

**Made with ❤️ for the AI community**
