# LittleLLM v1.0 🤖💬

A lightweight, floating AI chat application for Windows that provides quick access to multiple LLM providers with keyboard shortcuts.

![LittleLLM Screenshot](assets/icon.png)

## ✨ Features

### 🚀 **Multi-Provider Support**
- **OpenAI**: GPT-4o, GPT-4-turbo, GPT-3.5-turbo, O1-preview, O1-mini
- **OpenRouter**: 150+ models from multiple providers
- **Requesty**: 80+ models with smart routing
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus/Sonnet/Haiku
- **Ollama**: Local models support
- **Replicate**: Cloud-hosted models

### 🖼️ **Vision Support**
- Send images directly to vision-capable models
- Automatic image optimization (resize + compression)
- Supports screenshots, photos, and documents
- OpenRouter vision API integration

### ⚡ **Quick Access**
- Global keyboard shortcut (Ctrl+Shift+L)
- Floating window that stays on top
- Minimizes to system tray
- Auto-resize chat input (1-10 lines)
- ESC key to close window

### 🛠️ **Advanced Features**
- **Stop/Cancel**: Interrupt hanging requests
- **Provider-specific settings**: Separate API keys per provider
- **Temperature control**: Adjust model creativity
- **Token limits**: Prevent runaway generation
- **System prompts**: Customize AI behavior
- **Dark mode**: Multiple themes available

### 📁 **File Support**
- **Images**: PNG, JPG, GIF, WebP
- **Documents**: Text files, PDFs
- **Clipboard**: Paste images and text
- **Drag & drop**: Easy file attachment

## 🚀 Quick Start

### Download & Install

**Windows Installer (Recommended)**
1. Download `LittleLLM-Setup-1.0.0.exe` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Run the installer (may need "Run as administrator")
3. Follow installation wizard
4. Launch from Desktop shortcut or Start Menu

**Portable Version**
1. Download `LittleLLM-1.0.0-x64.exe` from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Place anywhere (Desktop, USB drive, etc.)
3. Double-click to run - no installation needed

📖 **[Full Installation Guide](INSTALLATION.md)**

### Setup API Keys
1. Click the settings icon ⚙️
2. Select your preferred provider
3. Enter your API key:
   - **OpenAI**: Get from [platform.openai.com](https://platform.openai.com)
   - **OpenRouter**: Get from [openrouter.ai](https://openrouter.ai)
   - **Requesty**: Get from [app.requesty.ai](https://app.requesty.ai)
   - **Anthropic**: Get from [console.anthropic.com](https://console.anthropic.com)

### Start Chatting
1. Press **Ctrl+Shift+L** to open the chat window
2. Select a model from the dropdown
3. Type your message and press Enter
4. Attach images by clicking the paperclip icon or pasting from clipboard

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
git clone https://github.com/yourusername/littlellm.git
cd littlellm
npm install
```

### Development Mode
```bash
# Start Next.js dev server
npm run dev

# Start Electron in dev mode
npm run electron-dev
```

### Build Executable
```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+L` | Open/Show LittleLLM |
| `Esc` | Close window |
| `Enter` | Send message |
| `Shift+Enter` | New line in chat input |
| `Ctrl+V` | Paste (including images) |

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
```bash
# Build for production
npm run build

# Build both installer and portable (Windows)
npm run build:windows

# Build specific versions
npm run dist:win-installer  # Windows installer (.exe)
npm run dist:win-portable   # Windows portable (.exe)
npm run dist:mac            # macOS (.dmg)
npm run dist:linux          # Linux (AppImage)
```

## 🐛 Recent Fixes

### Windows Installer & Distribution ✅
Created full Windows installer with setup wizard:
- **NSIS Installer**: Full installation with uninstaller, shortcuts, and Windows integration
- **Portable Version**: Single executable that runs without installation
- **Both versions**: Include the Windows taskbar icon fix

### Windows Taskbar Icon Issue ✅
Fixed the blank taskbar icon issue on Windows by:
- Regenerating ICO files with multiple sizes (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
- Implementing robust icon path resolution for different build environments
- Adding Windows-specific icon handling with `setIcon()` and `setAppUserModelId()`
- Configuring electron-builder for proper icon embedding in executables

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Desktop**: Electron 37
- **Styling**: Tailwind CSS, Radix UI components
- **Build**: Electron Builder for cross-platform distribution
- **Icons**: Multi-size ICO files for Windows compatibility

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [Electron](https://electronjs.org/)
- UI components from [Radix UI](https://radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

---

**LittleLLM v1.0** - Your lightweight AI companion 🚀
