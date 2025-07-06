# Custom NSIS installer script for LittleLLM
# This script adds custom installation steps and configurations

# Custom installer text
!define MUI_WELCOMEPAGE_TITLE "Welcome to LittleLLM Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of LittleLLM, a lightweight AI chat assistant.$\r$\n$\r$\nLittleLLM provides quick access to multiple AI providers with a floating chat window and global keyboard shortcuts.$\r$\n$\r$\nClick Next to continue."

# Custom finish page
!define MUI_FINISHPAGE_TITLE "LittleLLM Installation Complete"
!define MUI_FINISHPAGE_TEXT "LittleLLM has been successfully installed on your computer.$\r$\n$\r$\nYou can now launch LittleLLM from the Start Menu or Desktop shortcut.$\r$\n$\r$\nPress Ctrl+Shift+L to open the chat window from anywhere!"

# Custom uninstaller text
!define MUI_UNCONFIRMPAGE_TEXT_TOP "LittleLLM will be uninstalled from the following folder. Click Uninstall to start the uninstallation."

# Add custom installation steps
!macro customInstall
  # Register application for Windows notifications
  WriteRegStr HKLM "SOFTWARE\Classes\Applications\LittleLLM.exe\shell\open\command" "" "$INSTDIR\LittleLLM.exe"

  # Set application user model ID for taskbar grouping
  WriteRegStr HKLM "SOFTWARE\Classes\Applications\LittleLLM.exe" "AppUserModelID" "com.littlellm.app"
!macroend

!macro customUnInstall
  # Remove application registration
  DeleteRegKey HKLM "SOFTWARE\Classes\Applications\LittleLLM.exe"
!macroend
