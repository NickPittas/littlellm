# 🍎 LittleLLM macOS Installation Guide

This guide covers everything you need to know about installing and running LittleLLM on macOS.

## 📋 System Requirements

- **macOS**: 10.14 (Mojave) or later
- **Architecture**: Intel (x64) or Apple Silicon (arm64)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space

## 📦 Installation Options

### Option 1: DMG Installer (Recommended)

1. **Download** the latest DMG file from the [Releases page](https://github.com/NickPittas/littlellm/releases)
   - For Intel Macs: `LittleLLM-{version}-x64.dmg`
   - For Apple Silicon Macs: `LittleLLM-{version}-arm64.dmg`
   - Universal: `LittleLLM-{version}-universal.dmg` (works on both)

2. **Open** the downloaded DMG file

3. **Drag** LittleLLM.app to the Applications folder

4. **Launch** from Applications or Spotlight

### Option 2: ZIP Archive

1. **Download** the ZIP file from the [Releases page](https://github.com/NickPittas/littlellm/releases)

2. **Extract** the ZIP file

3. **Move** LittleLLM.app to your Applications folder

4. **Launch** the application

## 🔒 Security & Permissions

### First Launch

When you first open LittleLLM, macOS may show a security warning:

1. **If you see "LittleLLM can't be opened":**
   - Right-click on LittleLLM.app
   - Select "Open" from the context menu
   - Click "Open" in the dialog that appears

2. **Alternative method:**
   - Go to System Preferences > Security & Privacy
   - Click "Open Anyway" next to the LittleLLM message

### Required Permissions

LittleLLM may request the following permissions:

- **Network Access**: For connecting to AI providers
- **File Access**: For document processing and knowledge base
- **Camera** (optional): For vision features with image capture
- **Microphone** (optional): For future voice features

## 🛠️ Development Setup

### Prerequisites

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Node.js (18 or later)
# Download from https://nodejs.org or use Homebrew:
brew install node
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/NickPittas/littlellm.git
cd littlellm

# Install dependencies
npm install

# Create macOS icon (optional)
npm run create-mac-icon

# Build for macOS
npm run build:mac

# Or build specific formats
npm run dist:mac-dmg        # DMG installer
npm run dist:mac-zip        # ZIP archive
npm run dist:mac-universal  # Universal binary
```

## 🚨 Troubleshooting

### Common Issues

#### "App is damaged and can't be opened"
This usually happens with unsigned apps. Try:
```bash
# Remove quarantine attribute
sudo xattr -rd com.apple.quarantine /Applications/LittleLLM.app
```

#### "Permission denied" errors
```bash
# Fix permissions
chmod +x /Applications/LittleLLM.app/Contents/MacOS/LittleLLM
```

#### App won't start
1. Check Console.app for error messages
2. Try launching from Terminal:
   ```bash
   /Applications/LittleLLM.app/Contents/MacOS/LittleLLM
   ```

#### Vector database issues
If you encounter LanceDB-related errors:
```bash
# Reinstall with platform-specific dependencies
npm install --force
```

### Performance Tips

#### For Apple Silicon Macs
- Use the arm64 version for best performance
- The universal binary works but may be slightly slower

#### For Intel Macs
- Use the x64 version
- Ensure you have sufficient RAM for AI model processing

#### Memory Management
- Close unused chat windows
- Restart the app periodically for long sessions
- Monitor Activity Monitor if experiencing slowdowns

## 🔧 Configuration

### Default Locations

- **App Data**: `~/Library/Application Support/LittleLLM/`
- **Settings**: `~/Library/Application Support/LittleLLM/settings.json`
- **Knowledge Base**: `~/Library/Application Support/LittleLLM/knowledgebase.db`
- **Logs**: `~/Library/Logs/LittleLLM/`

### Backup Your Data

Before major updates, backup your settings and knowledge base:
```bash
cp -r "~/Library/Application Support/LittleLLM" ~/Desktop/LittleLLM-Backup
```

## 🆕 Updates

### Automatic Updates
- LittleLLM will check for updates automatically
- You'll be notified when a new version is available

### Manual Updates
1. Download the latest version
2. Replace the old app in Applications
3. Your settings and data will be preserved

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `~/Library/Logs/LittleLLM/`
2. **Search existing issues**: [GitHub Issues](https://github.com/NickPittas/littlellm/issues)
3. **Create a new issue**: Include your macOS version, Mac model, and error details
4. **Join the community**: Check the README for community links

## 🎯 Next Steps

After installation:

1. **Configure AI Providers**: Add your API keys in Settings
2. **Set Up MCP Servers**: Configure Model Context Protocol servers
3. **Import Documents**: Add files to the knowledge base
4. **Customize Settings**: Adjust themes, shortcuts, and preferences
5. **Explore Features**: Try vision support, tool calling, and RAG

---

**Enjoy using LittleLLM on macOS! 🚀**
