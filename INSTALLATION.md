# LittleLLM Installation Guide

LittleLLM is available in two distribution formats for Windows:

## 📦 Windows Installer (Recommended)

**File**: `LittleLLM-Setup-1.0.0.exe` (~146 MB)

### Features:
- ✅ **Full Windows Integration**: Proper installation with uninstaller
- ✅ **Desktop Shortcut**: Quick access from desktop
- ✅ **Start Menu Entry**: Find LittleLLM in Start Menu
- ✅ **Add/Remove Programs**: Uninstall through Windows Settings
- ✅ **Auto-start Option**: Optionally start with Windows (can be disabled)
- ✅ **Proper File Associations**: Windows recognizes the application
- ✅ **Taskbar Icon Fix**: Properly displays icon in Windows taskbar

### Installation Steps:
1. Download `LittleLLM-Setup-1.0.0.exe`
2. Right-click and select "Run as administrator" (recommended)
3. Follow the installation wizard:
   - Choose installation directory
   - Select components (Desktop shortcut, Start Menu, Auto-start)
   - Complete installation
4. Launch from Desktop shortcut or Start Menu

### What Gets Installed:
- **Program Files**: `C:\Program Files\LittleLLM\` (or chosen directory)
- **Desktop Shortcut**: `LittleLLM.lnk`
- **Start Menu**: `Start Menu\Programs\LittleLLM\`
- **Registry Entries**: For proper Windows integration
- **Uninstaller**: For clean removal

### Uninstallation:
- **Windows 10/11**: Settings → Apps → LittleLLM → Uninstall
- **Control Panel**: Programs and Features → LittleLLM → Uninstall
- **Start Menu**: LittleLLM folder → Uninstall LittleLLM

## 📱 Portable Version

**File**: `LittleLLM-1.0.0-x64.exe` (~123 MB)

### Features:
- ✅ **No Installation Required**: Run directly from any location
- ✅ **USB Drive Friendly**: Perfect for portable use
- ✅ **No Registry Changes**: Doesn't modify Windows registry
- ✅ **Self-contained**: All dependencies included
- ✅ **Taskbar Icon Fix**: Same icon fix as installer version

### Usage:
1. Download `LittleLLM-1.0.0-x64.exe`
2. Place in desired folder (Desktop, USB drive, etc.)
3. Double-click to run
4. No installation or admin rights required

### Portable Benefits:
- Run from USB drives or network locations
- No traces left on the system
- Easy to move between computers
- Perfect for testing or temporary use

## 🚀 First Launch

After installation or running the portable version:

1. **Global Shortcut**: Press `Ctrl+Shift+L` to open LittleLLM
2. **Settings**: Click the gear icon to configure API keys
3. **API Keys**: Add your OpenAI, Anthropic, or other provider keys
4. **Start Chatting**: Select a model and start your conversation

## 🔧 System Requirements

- **OS**: Windows 10 or Windows 11 (64-bit)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Storage**: 200 MB free space
- **Internet**: Required for AI provider APIs

## 🛠️ Troubleshooting

### Installation Issues:
- **"Windows protected your PC"**: Click "More info" → "Run anyway"
- **Permission denied**: Right-click installer → "Run as administrator"
- **Antivirus blocking**: Add exception for LittleLLM files

### Runtime Issues:
- **App won't start**: Check if port 3000/3001 is available
- **Blank window**: Try running as administrator
- **API errors**: Verify API keys in settings

### Taskbar Icon Issues:
- The installer version includes fixes for Windows taskbar icon display
- If icon appears blank, try restarting the application
- Both installer and portable versions include the same icon fixes

## 🔄 Updates

### Installer Version:
- Download new installer and run it
- Will update existing installation
- Settings and data are preserved

### Portable Version:
- Download new portable executable
- Replace old file with new one
- Copy settings if needed (stored in app data)

## 🗂️ Data Storage

### Installer Version:
- **Settings**: `%APPDATA%\LittleLLM\`
- **Logs**: `%APPDATA%\LittleLLM\logs\`

### Portable Version:
- **Settings**: Same folder as executable
- **Logs**: `logs\` subfolder

## 🔒 Security Notes

- Both versions are unsigned (no code signing certificate)
- Windows may show security warnings - this is normal
- Source code is available on GitHub for verification
- No telemetry or data collection

## 📞 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Visit: https://github.com/NickPittas/littlellm/issues
3. Create a new issue with details about your problem
