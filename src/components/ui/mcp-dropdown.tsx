

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

"use client"

import * as React from "react"
import { Server, RefreshCw, Zap } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { ToggleSwitch } from "./toggle-switch"
import { mcpService, type MCPServer } from "../../services/mcpService"

interface MCPDropdownProps {
  disabled?: boolean
  className?: string
}

export function MCPDropdown({
  disabled = false,
  className
}: MCPDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [servers, setServers] = React.useState<MCPServer[]>([])
  const [enabledServers, setEnabledServers] = React.useState<Set<string>>(new Set())
  const [connectedServers, setConnectedServers] = React.useState<Set<string>>(new Set())
  const [serverStatus, setServerStatus] = React.useState<Map<string, {
    status: string;
    error?: string;
    toolCount?: number;
    resourceCount?: number;
    promptCount?: number;
  }>>(new Map())
  
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  const [isLoading, setIsLoading] = React.useState(false)
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout>()

  const loadServers = React.useCallback(async () => {
    // Prevent concurrent loads
    if (isLoading) {
      safeDebugLog('info', 'MCP_DROPDOWN', '🔄 MCP Dropdown: Load already in progress, skipping')
      return
    }

    try {
      setIsLoading(true)
      safeDebugLog('info', 'MCP_DROPDOWN', '🔄 MCP Dropdown: Loading servers...')

      const mcpServers = await mcpService.getServers()
      setServers(mcpServers)

      // Track which servers are enabled
      const enabled = new Set(mcpServers.filter(s => s.enabled).map(s => s.id))
      setEnabledServers(enabled)

      // Track which servers are connected
      const connectedIds = await mcpService.getConnectedServerIds()
      const connected = new Set(connectedIds)
      setConnectedServers(connected)

      // Get detailed status for health indicators
      const detailedStatus = await mcpService.getDetailedStatus() as {
        servers?: Array<{
          id: string;
          connected: boolean;
          toolCount?: number;
          resourceCount?: number;
          promptCount?: number;
          hasProcess?: boolean;
        }>
      }
      const statusMap = new Map()

      if (detailedStatus?.servers) {
        detailedStatus.servers.forEach((serverInfo: {
          id: string;
          connected: boolean;
          toolCount?: number;
          resourceCount?: number;
          promptCount?: number;
          hasProcess?: boolean;
        }) => {
          statusMap.set(serverInfo.id, {
            connected: serverInfo.connected,
            toolCount: serverInfo.toolCount || 0,
            resourceCount: serverInfo.resourceCount || 0,
            promptCount: serverInfo.promptCount || 0,
            hasProcess: serverInfo.hasProcess || false
          })
        })
      }

      setServerStatus(statusMap)

      // MCP Status loaded
    } catch (error) {
      safeDebugLog('error', 'MCP_DROPDOWN', 'Failed to load MCP servers:', error)
    } finally {
      // Clear loading state after a short delay to prevent rapid successive calls
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false)
      }, 500) // 500ms debounce
    }
  }, [isLoading])

  // Load MCP servers on mount only (no auto-refresh)
  React.useEffect(() => {
    loadServers()
    // Removed auto-refresh interval - servers will be refreshed when needed (e.g., when toggling)

    // Cleanup timeout on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, []) // Empty dependency array - only run on mount

  const toggleServer = React.useCallback(async (serverId: string, currentlyEnabled: boolean) => {
    try {
      safeDebugLog('info', 'MCP_DROPDOWN', `🔄 MCP Dropdown: toggleServer called for ${serverId}: ${currentlyEnabled} -> ${!currentlyEnabled}`)
      safeDebugLog('info', 'MCP_DROPDOWN', '🔄 MCP Dropdown: mcpService available:', !!mcpService)

      // Use the exact same logic as SettingsOverlay.tsx handleUpdateMcpServer
      const wasEnabled = currentlyEnabled
      const willBeEnabled = !currentlyEnabled
      const updates = { enabled: willBeEnabled }

      // Update server enabled state
      await mcpService.updateServer(serverId, updates)

      // Handle connection changes - same logic as settings page
      if (wasEnabled !== willBeEnabled) {
        if (willBeEnabled) {
          safeDebugLog('info', 'MCP_DROPDOWN', '🔌 Connecting MCP server after enable:', serverId)
          try {
            await mcpService.connectServer(serverId)
          } catch (connectError) {
            safeDebugLog('warn', 'MCP_DROPDOWN', '⚠️ Failed to connect server after enable:', connectError)
          }
        } else {
          safeDebugLog('info', 'MCP_DROPDOWN', '🔌 Disconnecting MCP server after disable:', serverId)
          try {
            await mcpService.disconnectServer(serverId)
          } catch (disconnectError) {
            safeDebugLog('warn', 'MCP_DROPDOWN', '⚠️ Failed to disconnect server after disable:', disconnectError)
          }
        }
      }

      // Update local state immediately for responsive UI
      const newEnabledServers = new Set(enabledServers)
      const newConnectedServers = new Set(connectedServers)

      if (willBeEnabled) {
        newEnabledServers.add(serverId)
        newConnectedServers.add(serverId)
      } else {
        newEnabledServers.delete(serverId)
        newConnectedServers.delete(serverId)
      }

      setEnabledServers(newEnabledServers)
      setConnectedServers(newConnectedServers)

      safeDebugLog('info', 'MCP_DROPDOWN', '🔄 Updated local state - enabledServers:', Array.from(newEnabledServers))
      safeDebugLog('info', 'MCP_DROPDOWN', '🔄 Updated local state - connectedServers:', Array.from(newConnectedServers))

      // Trigger settings reload for MCP server change (explicit requirement) - same as settings page
      const { settingsService } = await import('../../services/settingsService')
      await settingsService.reloadForMCPChange()

      // Force reload servers to ensure UI is in sync with backend state
      safeDebugLog('info', 'MCP_DROPDOWN', '🔄 Reloading servers to sync UI state...')
      await loadServers()

      safeDebugLog('info', 'MCP_DROPDOWN', '✅ MCP server update completed')
    } catch (error) {
      safeDebugLog('error', 'MCP_DROPDOWN', '❌ Failed to update MCP server:', error)
      // Only reload if not already loading to prevent loops
      if (!isLoading) {
        setTimeout(() => loadServers(), 1000) // Delayed reload to prevent loops
      }
    }
  }, [enabledServers, connectedServers, loadServers, isLoading])

  const restartServer = async (serverId: string) => {
    try {
      safeDebugLog('info', 'MCP_DROPDOWN', `🔄 Restarting MCP server ${serverId}`)

      // Disconnect first
      await mcpService.disconnectServer(serverId)

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500))

      // Reconnect
      const connected = await mcpService.connectServer(serverId)
      safeDebugLog('info', 'MCP_DROPDOWN', `🔌 MCP server ${serverId} restart result:`, connected)

      // Update local state instead of full reload
      if (connected) {
        setConnectedServers(prev => new Set([...prev, serverId]))
      }

      safeDebugLog('info', 'MCP_DROPDOWN', `✅ MCP server ${serverId} restart completed`)
    } catch (error) {
      safeDebugLog('error', 'MCP_DROPDOWN', '❌ Failed to restart MCP server:', error)
      // Only reload if not already loading to prevent loops
      if (!isLoading) {
        setTimeout(() => loadServers(), 1000) // Delayed reload to prevent loops
      }
    }
  }

  const handleClose = React.useCallback(async () => {
    if (isElectron) {
      try {
        await window.electronAPI.closeDropdown()
      } catch (error) {
        safeDebugLog('error', 'MCP_DROPDOWN', 'Failed to close floating dropdown:', error)
      }
    }
    setOpen(false)
  }, [isElectron])

  // Handle MCP dropdown selection events from Electron
  React.useEffect(() => {
    if (!isElectron) return;

    const handleSelection = (selectedValue: string) => {
      safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: handleSelection called with:', selectedValue);
      safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: typeof selectedValue:', typeof selectedValue);

      // ONLY handle MCP-related selections to avoid conflicts with other dropdowns
      const isMCPToggle = selectedValue.startsWith('mcp-toggle:');
      const isMCPServer = servers.some(s => s.id === selectedValue);

      if (!isMCPToggle && !isMCPServer) {
        safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Ignoring non-MCP selection:', selectedValue);
        return;
      }

      // Handle new toggle format: "mcp-toggle:serverId:currentlyEnabled"
      if (selectedValue.startsWith('mcp-toggle:')) {
        const parts = selectedValue.split(':');
        safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Toggle format detected, parts:', parts);
        if (parts.length === 3) {
          const serverId = parts[1];
          const currentlyEnabled = parts[2] === 'true';
          safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Calling toggleServer with:', serverId, currentlyEnabled);
          toggleServer(serverId, currentlyEnabled);
          return; // Don't close dropdown for toggle switches
        } else {
          safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Invalid toggle format, expected 3 parts, got:', parts.length);
        }
      }

      // Try to parse as JSON for legacy toggle switch events
      try {
        const parsed = JSON.parse(selectedValue);
        if (parsed.type === 'mcp-toggle') {
          safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Legacy toggle switch clicked:', parsed.serverId);
          toggleServer(parsed.serverId, parsed.currentlyEnabled);
          return; // Don't close dropdown for toggle switches
        }
      } catch {
        // Not JSON, handle as regular string selection
      }

      // Handle regular server selection (string)
      if (typeof selectedValue === 'string') {
        // ONLY handle values that are actually MCP server IDs
        // This prevents intercepting provider/model selections
        const server = servers.find(s => s.id === selectedValue);
        if (!server) {
          safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Ignoring selection not in our servers:', selectedValue);
          return;
        }

        safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Toggling server:', server.name);
        const currentlyEnabled = enabledServers.has(server.id);
        toggleServer(server.id, currentlyEnabled);
        setOpen(false);
      }
    };

    // Register MCP dropdown listener
    if (window.electronAPI?.onDropdownItemSelected) {
      safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Registering listener');
      window.electronAPI.onDropdownItemSelected(handleSelection);

      return () => {
        safeDebugLog('info', 'MCP_DROPDOWN', '🔥 MCP DROPDOWN: Cleanup (not removing listeners)');
      };
    }
  }, [servers, enabledServers, isElectron, toggleServer]);

  const generateMCPDropdownHTML = (servers: MCPServer[], enabledServers: Set<string>) => {
    const serverItems = servers.map(server => {
      const isEnabled = enabledServers.has(server.id)
      return `
        <div class="dropdown-item">
          <div class="server-info">
            <div class="server-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
                <line x1="6" x2="6" y1="6" y2="10"/>
                <line x1="6" x2="6" y1="18" y2="22"/>
              </svg>
            </div>
            <div class="server-details">
              <div class="server-name">${server.name}</div>
              ${server.description ? `<div class="server-description">${server.description}</div>` : ''}
            </div>
          </div>
          <div class="server-status">
            <div class="status-icon">
              ${isEnabled ?
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-enabled">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>` :
                `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-disabled">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>`
              }
            </div>
            <div class="toggle-switch ${isEnabled ? 'toggle-enabled' : 'toggle-disabled'} dropdown-item"
                 data-value="mcp-toggle:${server.id}:${isEnabled}"
                 data-server-id="${server.id}"
                 data-enabled="${isEnabled}"
                 onclick="safeDebugLog('info', 'MCP_DROPDOWN', '🔥 HTML Toggle clicked:', '${server.id}', ${isEnabled}); safeDebugLog('info', 'MCP_DROPDOWN', '🔥 electronAPI available:', !!window.electronAPI); safeDebugLog('info', 'MCP_DROPDOWN', '🔥 selectDropdownItem available:', !!window.electronAPI?.selectDropdownItem); window.electronAPI?.selectDropdownItem?.('mcp-toggle:${server.id}:${isEnabled}');">
              <div class="toggle-track">
                <div class="toggle-thumb"></div>
              </div>
            </div>
          </div>
        </div>
      `
    }).join('')

    return `
      <style>
        /* MCP-specific styles - main process handles theme colors */
        .dropdown-header {
          padding: 8px 12px;
          font-size: 12px;
          color: hsl(var(--muted-foreground));
          border-bottom: 1px solid hsl(var(--border));
          background: hsl(var(--muted));
        }
        .dropdown-item {
          padding: 8px 12px;
          border-bottom: 1px solid hsl(var(--border));
          cursor: default;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 48px;
          color: hsl(var(--foreground));
        }
        .dropdown-item:hover {
          background: hsl(var(--accent) / 0.1);
          color: hsl(var(--foreground));
        }
        .dropdown-item:last-child {
          border-bottom: none;
        }
        .server-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .server-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          color: var(--muted-foreground);
        }
        .server-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .server-name {
          font-size: 14px;
          font-weight: 500;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .server-description {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .server-status {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .status-icon {
          width: 16px;
          height: 16px;
        }
        .status-text {
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
        }

        /* iOS-style toggle switch */
        .toggle-switch {
          cursor: pointer;
          user-select: none;
        }
        .toggle-track {
          width: 36px;
          height: 20px;
          border-radius: 10px;
          position: relative;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }
        .toggle-enabled .toggle-track {
          background-color: #22c55e;
        }
        .toggle-disabled .toggle-track {
          background-color: #d1d5db;
        }
        .toggle-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: white;
          position: absolute;
          top: 2px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .toggle-enabled .toggle-thumb {
          transform: translateX(16px);
        }
        .toggle-disabled .toggle-thumb {
          transform: translateX(2px);
        }
        .toggle-switch:hover .toggle-track {
          opacity: 0.9;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
        .status-enabled {
          color: hsl(142.1 76.2% 36.3%);
        }
        .status-disabled {
          color: hsl(0 84.2% 60.2%);
        }
        .empty-state {
          padding: 16px;
          text-align: center;
          color: var(--muted-foreground);
          font-size: 14px;
        }
        /* Enable scrolling with hidden scrollbars */
        .dropdown-container {
          max-height: 400px;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .dropdown-container::-webkit-scrollbar {
          display: none;
        }
        .dropdown-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        /* Ensure no scrollbars on any child elements */
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
      </style>

      <div class="dropdown-container">
        ${servers.length === 0 ?
          '<div class="empty-state">No MCP servers configured</div>' :
          `<div class="dropdown-header">
            ${servers.length} MCP server${servers.length === 1 ? '' : 's'}
          </div>${serverItems}`
        }
      </div>
    `
  }

  const openDropdown = async () => {
    // Only refresh servers if we haven't loaded them recently or if not currently loading
    if (servers.length === 0 && !isLoading) {
      await loadServers()
    }

    if (!isElectron || !triggerRef.current) {
      setOpen(true)
      return
    }

    const dropdownWidth = 320
    // Calculate height: header (32px) + servers (48px each) + padding (16px) + 15px for draggable header
    const serverHeight = 48 // Each server item height
    const headerHeight = 32 // Header height
    const padding = 16 // Top and bottom padding
    const maxHeight = 415 // Maximum dropdown height (increased by 15px)

    const calculatedHeight = servers.length === 0
      ? headerHeight + 32 + padding // Empty state height
      : Math.min(maxHeight, headerHeight + (servers.length * serverHeight) + padding)

    const dropdownHeight = calculatedHeight

    try {
      // Get trigger button position relative to the window (not viewport)
      const rect = triggerRef.current.getBoundingClientRect()

      // Calculate position below the trigger
      const x = rect.left
      const y = rect.bottom + 4 // 4px gap below trigger

      safeDebugLog('info', 'MCP_DROPDOWN', '🔍 MCP Dropdown positioning:', {
        buttonRect: rect,
        calculatedPosition: { x, y },
        dropdownSize: { width: dropdownWidth, height: dropdownHeight }
      })

      // Generate HTML content for dropdown
      const content = generateMCPDropdownHTML(servers, enabledServers)

      // Open dropdown at calculated position (theme will be retrieved from main window)
      await window.electronAPI.openDropdown(x, y, dropdownWidth, dropdownHeight, content)
      setOpen(true)
    } catch (error) {
      safeDebugLog('error', 'MCP_DROPDOWN', 'Failed to open floating dropdown:', error)
      setOpen(true) // Fallback to regular dropdown
    }
  }

  const toggleDropdown = () => {
    if (disabled) return

    if (open) {
      handleClose()
    } else {
      openDropdown()
    }
  }

  // Note: MCP dropdown selection is handled by the specific handler above (lines 163-191)
  // This prevents conflicts with other dropdowns that use the global event system

  // Close dropdown when clicking outside (for non-Electron fallback)
  React.useEffect(() => {
    if (!isElectron && open) {
      const handleClickOutside = (event: MouseEvent) => {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, isElectron]);

  const enabledCount = enabledServers.size
  const totalCount = servers.length

  return (
    <div className="relative" style={{ zIndex: 1 }}>
      <Button
        ref={triggerRef}
        variant="ghost"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "justify-center items-center font-normal h-8 w-8 p-0 bg-transparent",
          className
        )}
        disabled={disabled}
        onClick={toggleDropdown}
        title={`MCP Servers: ${enabledCount}/${totalCount} enabled, ${connectedServers.size} connected`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <Zap className="h-4 w-4 transition-colors" />
      </Button>

      {open && !isElectron && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          />
          
          {/* Dropdown content */}
          <div
            className="mcp-dropdown-content absolute top-full left-0 mt-1 w-80 bg-popover border border-border rounded-md shadow-lg z-[99999]"
            style={{
              WebkitAppRegion: 'no-drag',
              maxHeight: '400px',
              overflow: 'hidden'
            } as React.CSSProperties & { WebkitAppRegion?: string }}
            onClick={(e) => {
              // Prevent dropdown from closing when clicking inside
              e.stopPropagation();
            }}
          >
            <div className="p-1 overflow-y-auto scrollbar-hide" style={{ maxHeight: '400px' }}>
              {servers.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No MCP servers configured
                </div>
              ) : (
                <>
                  <div className="px-2 py-1 text-xs text-muted-foreground border-b flex items-center justify-between">
                    <span>{servers.length} MCP server{servers.length === 1 ? '' : 's'}</span>
                    <span className="flex items-center gap-1">
                      <span className="text-green-600">{enabledCount} enabled</span>
                      <span>•</span>
                      <span className="text-blue-600">{connectedServers.size} connected</span>
                    </span>
                  </div>
                  {servers.map((server) => {
                    const isEnabled = enabledServers.has(server.id)
                    const isConnected = connectedServers.has(server.id)
                    const status = serverStatus.get(server.id)

                    return (
                      <div
                        key={server.id}
                        className={`p-2 rounded-sm border-l-2 ${
                          isEnabled
                            ? 'border-l-green-500 bg-green-50/50 hover:bg-green-100/50'
                            : 'border-l-gray-300 bg-gray-50/50 hover:bg-gray-100/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Server className={`h-4 w-4 ${isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {server.name}
                                </span>

                                {/* Status badge */}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  isEnabled
                                    ? isConnected
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isEnabled
                                    ? isConnected
                                      ? 'Connected'
                                      : 'Disconnected'
                                    : 'Disabled'
                                  }
                                </span>

                                {/* Capability indicators */}
                                {isEnabled && isConnected && status && (
                                  <span
                                    className="text-xs text-muted-foreground"
                                    title={`Tools: ${status.toolCount ?? 0}, Resources: ${status.resourceCount ?? 0}, Prompts: ${status.promptCount ?? 0}`}
                                  >
                                    {(status.toolCount ?? 0) > 0 && `${status.toolCount}t`}
                                    {(status.resourceCount ?? 0) > 0 && ` ${status.resourceCount}r`}
                                    {(status.promptCount ?? 0) > 0 && ` ${status.promptCount}p`}
                                    {(status.toolCount ?? 0) === 0 && (status.resourceCount ?? 0) === 0 && (status.promptCount ?? 0) === 0 && 'no capabilities'}
                                  </span>
                                )}
                              </div>
                              {server.description && (
                                <span className="text-xs text-muted-foreground">{server.description}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Restart button for enabled servers */}
                            {isEnabled && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  restartServer(server.id);
                                }}
                                className="p-1 hover:bg-accent-foreground/10 rounded"
                                title="Restart server"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            )}

                            {/* iPhone-style toggle switch */}
                            <div
                              onMouseDown={(e) => {
                                safeDebugLog('info', 'MCP_DROPDOWN', '🔄 MCP Toggle switch mousedown:', server.id);
                                // Prevent dropdown from closing
                                e.stopPropagation();
                              }}
                            >
                              <ToggleSwitch
                                enabled={isEnabled}
                                onToggle={async (newEnabledState) => {
                                  safeDebugLog('info', 'MCP_DROPDOWN', '🔄 MCP Toggle switch clicked:', server.id, 'currently enabled:', isEnabled, 'new state requested:', newEnabledState);
                                  // The toggleServer function expects the CURRENT state, not the new state
                                  // This is because it calculates willBeEnabled = !currentlyEnabled
                                  await toggleServer(server.id, isEnabled);
                                }}
                                size="sm"
                                className="focus:ring-offset-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
