# LittleLLM v2.0.1 Release Notes

## 🎉 What's New in Version 2.0.1

### 🍎 **macOS Compatibility** ✨
- **Full macOS Support**: LittleLLM now runs natively on macOS (Intel and Apple Silicon)
- **Universal Binaries**: Single app works on both Intel and Apple Silicon Macs
- **DMG Installer**: Professional macOS installer with drag-to-Applications workflow
- **Code Signing Ready**: Proper entitlements and hardened runtime for distribution
- **Platform-Specific Dependencies**: Automatic LanceDB binary selection for each platform

### 🔧 **Cross-Platform Enhancements**
- **Linux Support**: Enhanced AppImage distribution for Linux users
- **Platform Detection**: Improved platform-specific code paths and optimizations
- **Build System**: Comprehensive build scripts for all platforms
- **Icon Generation**: Platform-appropriate icon formats (.ico, .icns, .png)

### 🛠️ **Technical Improvements**
- **LanceDB Cross-Platform**: Fixed Windows-only dependency, now supports all platforms
- **Module System**: Updated to ES modules for better compatibility
- **Build Scripts**: Added Mac-specific build commands and icon generation
- **Documentation**: Comprehensive installation guides for each platform

### 📦 **Distribution Formats**

#### Windows
- **Installer**: `LittleLLM-Setup-2.0.1.exe` with NSIS installer
- **Portable**: `LittleLLM-Portable-2.0.1.exe` for standalone use

#### macOS
- **DMG**: `LittleLLM-2.0.1-x64.dmg` (Intel Macs)
- **DMG**: `LittleLLM-2.0.1-arm64.dmg` (Apple Silicon Macs)
- **Universal**: `LittleLLM-2.0.1-universal.dmg` (Both architectures)
- **ZIP**: Alternative distribution format for advanced users

#### Linux
- **AppImage**: `LittleLLM-2.0.1.AppImage` for universal Linux compatibility

### 🔄 **Upgrade Notes**

- **Cross-Platform Release**: Major expansion to macOS and Linux platforms
- **Dependency Updates**: LanceDB now uses platform-specific optional dependencies
- **Build System**: Enhanced with platform-specific scripts and configurations
- **All user settings and data are preserved during upgrade**
- **MCP server configurations remain unchanged**

### 📦 **Build Information**

- **Version**: 2.0.1
- **Build Date**: January 22, 2025
- **Electron Version**: 37.1.0
- **Next.js Version**: 14.1.0
- **Platforms**: Windows, macOS (Intel + Apple Silicon), Linux

### 🚀 **Installation Instructions**

#### Windows
1. Download installer or portable version from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Run the installer or extract portable version
3. Launch from Desktop shortcut or Start Menu

#### macOS
1. Download appropriate DMG for your Mac architecture
2. Open DMG and drag LittleLLM to Applications folder
3. Right-click and "Open" on first launch (Gatekeeper)
4. See [INSTALLATION_MAC.md](INSTALLATION_MAC.md) for detailed instructions

#### Linux
1. Download AppImage from [Releases](https://github.com/NickPittas/littlellm/releases)
2. Make executable: `chmod +x LittleLLM-2.0.1.AppImage`
3. Run: `./LittleLLM-2.0.1.AppImage`

### 🐛 **Bug Reports**

If you encounter any issues with this release, please report them on [GitHub Issues](https://github.com/NickPittas/littlellm/issues) with:
- Your operating system and version
- Mac architecture (Intel/Apple Silicon) if applicable
- Steps to reproduce the issue
- Any relevant error messages or logs

### 🙏 **Acknowledgments**

Thank you to the community for requesting cross-platform support! This release makes LittleLLM accessible to users across all major desktop platforms.

---

**Installation Guides**: [Windows](INSTALLATION.md) | [macOS](INSTALLATION_MAC.md) | [Cross-Platform Summary](MAC_COMPATIBILITY_SUMMARY.md)
