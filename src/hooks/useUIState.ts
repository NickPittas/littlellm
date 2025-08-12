/**
 * useUIState Hook - Manages UI state for panels, modals, and interface elements
 * Extracted from ModernChatInterface to reduce component complexity
 */

import { useState, useCallback } from 'react';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export interface UseUIStateReturn {
  // Panel states
  rightPanelOpen: boolean;
  activePanel: string;
  historyPanelOpen: boolean;
  
  // Modal states
  settingsModalOpen: boolean;
  agentManagementOpen: boolean;
  modelInstructionsOpen: boolean;
  quickPromptsOpen: boolean;
  
  // Provider selector states
  providerSelectorOpen: boolean;
  providerAnchorElement: HTMLElement | null;
  
  // Input state
  inputValue: string;
  
  // Actions
  setRightPanelOpen: (open: boolean) => void;
  setActivePanel: (panel: string) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setAgentManagementOpen: (open: boolean) => void;
  setModelInstructionsOpen: (open: boolean) => void;
  setQuickPromptsOpen: (open: boolean) => void;
  setProviderSelectorOpen: (open: boolean) => void;
  setProviderAnchorElement: (element: HTMLElement | null) => void;
  setInputValue: (value: string) => void;
  
  // Operations
  handleSidebarItemClick: (itemId: string) => void;
  openRightPanel: (panelType: string) => void;
  closeAllPanels: () => void;
  closeAllModals: () => void;
}

export function useUIState(): UseUIStateReturn {
  // Panel states
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  
  // Modal states
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [agentManagementOpen, setAgentManagementOpen] = useState(false);
  const [modelInstructionsOpen, setModelInstructionsOpen] = useState(false);
  const [quickPromptsOpen, setQuickPromptsOpen] = useState(false);
  
  // Provider selector states
  const [providerSelectorOpen, setProviderSelectorOpen] = useState(false);
  const [providerAnchorElement, setProviderAnchorElement] = useState<HTMLElement | null>(null);
  
  // Input state
  const [inputValue, setInputValue] = useState('');

  // Handle sidebar item clicks
  const handleSidebarItemClick = useCallback((itemId: string) => {
    safeDebugLog('info', 'USEUISTATE', 'Sidebar item clicked:', itemId);

    // Handle different sidebar actions
    switch (itemId) {
      case 'agents':
        setAgentManagementOpen(true);
        break;
      case 'settings':
        setSettingsModalOpen(true);
        break;
      case 'prompts':
        // Open the action menu (prompts selector) - same as the old interface
        if (typeof window !== 'undefined' && window.electronAPI) {
          const electronAPI = window.electronAPI as {
            openActionMenu?: () => void;
          };
          if (electronAPI.openActionMenu) {
            electronAPI.openActionMenu();
          }
        }
        break;
      case 'mcp-servers':
        setActivePanel('mcp-servers');
        setRightPanelOpen(true);
        break;
      case 'knowledge-base':
        setActivePanel('knowledge-base');
        setRightPanelOpen(true);
        break;
      case 'history':
        setHistoryPanelOpen(true);
        break;
      default:
        safeDebugLog('warn', 'USEUISTATE', 'Unknown sidebar item:', itemId);
    }
  }, []);

  // Open right panel with specific type
  const openRightPanel = useCallback((panelType: string) => {
    setActivePanel(panelType);
    setRightPanelOpen(true);
    safeDebugLog('info', 'USEUISTATE', 'Opened right panel:', panelType);
  }, []);

  // Close all panels
  const closeAllPanels = useCallback(() => {
    setRightPanelOpen(false);
    setHistoryPanelOpen(false);
    setActivePanel('');
    safeDebugLog('info', 'USEUISTATE', 'All panels closed');
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    setSettingsModalOpen(false);
    setAgentManagementOpen(false);
    setModelInstructionsOpen(false);
    setQuickPromptsOpen(false);
    setProviderSelectorOpen(false);
    setProviderAnchorElement(null);
    safeDebugLog('info', 'USEUISTATE', 'All modals closed');
  }, []);

  return {
    // Panel states
    rightPanelOpen,
    activePanel,
    historyPanelOpen,
    
    // Modal states
    settingsModalOpen,
    agentManagementOpen,
    modelInstructionsOpen,
    quickPromptsOpen,
    
    // Provider selector states
    providerSelectorOpen,
    providerAnchorElement,
    
    // Input state
    inputValue,
    
    // Actions
    setRightPanelOpen,
    setActivePanel,
    setHistoryPanelOpen,
    setSettingsModalOpen,
    setAgentManagementOpen,
    setModelInstructionsOpen,
    setQuickPromptsOpen,
    setProviderSelectorOpen,
    setProviderAnchorElement,
    setInputValue,
    
    // Operations
    handleSidebarItemClick,
    openRightPanel,
    closeAllPanels,
    closeAllModals
  };
}
