# LittleLLM v1.9.0 Release Notes

## 🎉 What's New in Version 1.9.0

### 🔧 **Major Bug Fixes**

#### **Fixed Chat Window Visibility Issues with Global Shortcuts**
- **Issue**: When using the global hide/show shortcut, the chat window would not restore properly after being hidden
- **Root Causes Fixed**:
  - Global shortcut only restored the main window, ignoring chat window state
  - No state tracking for previously open chat windows
  - "Open Chat" button could become unresponsive after global hide/show cycles

#### **Improvements Made**:
1. **Added Chat Window State Tracking**
   - System now remembers if the chat window was open before global hide
   - Ensures proper restoration during global show operations

2. **Enhanced Global Shortcut Logic**
   - Modified global shortcut handler to track chat window visibility before hiding
   - Added logic to restore chat window during global show if it was previously visible
   - Chat window now properly restores along with the main window

3. **Improved Open Chat Button Reliability**
   - Updated the "Open Chat" button to always show the chat window, even if it exists but is hidden
   - Button now works unconditionally regardless of previous hide/show cycles
   - Maintains all existing functionality while ensuring reliability

#### **Expected Behavior Now**:
- ✅ **Global Hide**: Both main and chat windows hide, system remembers chat window state
- ✅ **Global Show**: Both main and chat windows restore if chat was previously visible
- ✅ **Open Chat Button**: Always works to show/open chat window regardless of previous state
- ✅ **Message Sending**: Continues to auto-open chat window when sending messages

### 🛠️ **Technical Improvements**

- **Enhanced Window State Management**: Improved tracking and restoration of window visibility states
- **Better User Experience**: Consistent behavior across all window management operations
- **Maintained Backward Compatibility**: All existing features continue to work as expected

### 📦 **Build Information**

- **Version**: 1.9.0
- **Build Date**: July 18, 2025
- **Electron Version**: 37.1.0
- **Next.js Version**: 14.1.0

### 📥 **Download Options**

Two installation options are available:

1. **LittleLLM-Setup-1.9.0.exe** (~153 MB)
   - Full installer with NSIS setup
   - Creates desktop and start menu shortcuts
   - Recommended for most users

2. **LittleLLM-Portable-1.9.0.exe** (~128 MB)
   - Portable executable that doesn't require installation
   - Perfect for running from USB drives or temporary locations
   - No system modifications required

### 🔄 **Upgrade Notes**

- This is a bug fix release focusing on window management improvements
- No breaking changes to existing functionality
- All user settings and data are preserved during upgrade
- MCP server configurations remain unchanged

### 🐛 **Bug Reports**

If you encounter any issues with this release, please report them through the appropriate channels with:
- Steps to reproduce the issue
- Your operating system version
- Any relevant error messages or logs

### 🙏 **Acknowledgments**

Thank you to all users who reported the chat window visibility issues. Your feedback helps make LittleLLM better for everyone!

---

**Previous Versions**: [v1.8.7](RELEASE_NOTES_v1.8.7.md) | [v1.5.5](RELEASE_NOTES_v1.5.5.md) | [v1.5.0](RELEASE_NOTES_v1.5.md)
