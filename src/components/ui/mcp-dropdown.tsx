"use client"

import * as React from "react"
import { ChevronDown, Server, Check, X, RefreshCw, AlertCircle, Zap } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
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
  const [serverStatus, setServerStatus] = React.useState<Map<string, any>>(new Map())
  
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  // Load MCP servers on mount only (no auto-refresh)
  React.useEffect(() => {
    loadServers()
    // Removed auto-refresh interval - servers will be refreshed when needed (e.g., when toggling)
  }, [])



  const loadServers = async () => {
    try {
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
      const detailedStatus = await mcpService.getDetailedStatus()
      const statusMap = new Map()

      if (detailedStatus?.servers) {
        detailedStatus.servers.forEach((serverInfo: any) => {
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

      console.log('📊 MCP Status loaded:', {
        totalServers: mcpServers.length,
        enabledServers: enabled.size,
        connectedServers: connectedIds.length,
        detailedStatus: detailedStatus
      })
    } catch (error) {
      console.error('Failed to load MCP servers:', error)
    }
  }

  const toggleServer = async (serverId: string, currentlyEnabled: boolean) => {
    try {
      console.log(`🔄 MCP Dropdown: Toggling server ${serverId}: ${currentlyEnabled} -> ${!currentlyEnabled}`)
      console.log('🔄 MCP Dropdown: Current enabled servers:', Array.from(enabledServers))

      // Update server enabled state
      await mcpService.updateServer(serverId, { enabled: !currentlyEnabled })

      // If enabling, try to connect the server
      if (!currentlyEnabled) {
        console.log(`🔌 Connecting MCP server ${serverId}`)
        const connected = await mcpService.connectServer(serverId)
        console.log(`🔌 MCP server ${serverId} connection result:`, connected)
      } else {
        console.log(`🔌 Disconnecting MCP server ${serverId}`)
        await mcpService.disconnectServer(serverId)
      }

      // Update local state immediately for responsive UI
      const newEnabledServers = new Set(enabledServers)
      const newConnectedServers = new Set(connectedServers)

      if (currentlyEnabled) {
        newEnabledServers.delete(serverId)
        newConnectedServers.delete(serverId)
      } else {
        newEnabledServers.add(serverId)
        // Connection status will be updated by loadServers
      }

      setEnabledServers(newEnabledServers)
      setConnectedServers(newConnectedServers)

      // Reload servers to get updated state
      await loadServers()

      // Trigger settings reload for MCP server change (explicit requirement)
      const { settingsService } = await import('../../services/settingsService')
      await settingsService.reloadForMCPChange()

      console.log(`✅ MCP server ${serverId} toggle completed`)
    } catch (error) {
      console.error('❌ Failed to toggle MCP server:', error)
      // Reload servers to ensure UI is in sync
      await loadServers()
    }
  }

  const restartServer = async (serverId: string) => {
    try {
      console.log(`🔄 Restarting MCP server ${serverId}`)

      // Disconnect first
      await mcpService.disconnectServer(serverId)

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500))

      // Reconnect
      const connected = await mcpService.connectServer(serverId)
      console.log(`🔌 MCP server ${serverId} restart result:`, connected)

      // Reload servers to get updated state
      await loadServers()

      console.log(`✅ MCP server ${serverId} restart completed`)
    } catch (error) {
      console.error('❌ Failed to restart MCP server:', error)
      // Reload servers to ensure UI is in sync
      await loadServers()
    }
  }

  const handleClose = React.useCallback(async () => {
    if (isElectron) {
      try {
        await window.electronAPI.closeDropdown()
      } catch (error) {
        console.error('Failed to close floating dropdown:', error)
      }
    }
    setOpen(false)
  }, [isElectron])

  // Handle MCP dropdown selection events from Electron
  React.useEffect(() => {
    if (!isElectron || !window.electronAPI?.onDropdownItemSelected) return;

    const handleSelection = (selectedValue: string) => {
      console.log('🔥 MCP DROPDOWN: Item selected:', selectedValue);

      // ONLY handle values that are actually MCP server IDs
      // This prevents intercepting provider/model selections
      const server = servers.find(s => s.id === selectedValue);
      if (!server) {
        console.log('🔥 MCP DROPDOWN: Ignoring selection not in our servers:', selectedValue);
        return;
      }

      console.log('🔥 MCP DROPDOWN: Toggling server:', server.name);
      const currentlyEnabled = enabledServers.has(server.id);
      toggleServer(server.id, currentlyEnabled);
      setOpen(false);
    };

    window.electronAPI.onDropdownItemSelected(handleSelection);

    return () => {
      // Don't remove all listeners - just let this one be overridden
      // The electron API will handle multiple listeners properly
    };
  }, [servers, enabledServers]);

  const generateMCPDropdownHTML = (servers: MCPServer[], enabledServers: Set<string>) => {
    const serverItems = servers.map(server => {
      const isEnabled = enabledServers.has(server.id)
      return `
        <div class="dropdown-item" data-value="${server.id}">
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
            <span class="status-text ${isEnabled ? 'status-enabled' : 'status-disabled'}">
              ${isEnabled ? 'ON' : 'OFF'}
            </span>
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
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 48px;
        }
        .dropdown-item:hover {
          background: hsl(var(--accent));
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
          color: hsl(var(--muted-foreground));
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
          color: hsl(var(--card-foreground));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .server-description {
          font-size: 12px;
          color: hsl(0 0% 63.9%);
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
        .status-enabled {
          color: hsl(142.1 76.2% 36.3%);
        }
        .status-disabled {
          color: hsl(0 84.2% 60.2%);
        }
        .empty-state {
          padding: 16px;
          text-align: center;
          color: hsl(0 0% 63.9%);
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
    // Refresh servers before opening to get latest data
    await loadServers()

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

      console.log('🔍 MCP Dropdown positioning:', {
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
      console.error('Failed to open floating dropdown:', error)
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
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "justify-between font-normal h-8 w-8 p-0",
          className
        )}
        disabled={disabled}
        onClick={toggleDropdown}
        title={`MCP Servers: ${enabledCount}/${totalCount} enabled, ${connectedServers.size} connected`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <div className="flex items-center justify-center w-full">
          <Server className="h-4 w-4" />
        </div>
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
                                    title={`Tools: ${status.toolCount}, Resources: ${status.resourceCount}, Prompts: ${status.promptCount}`}
                                  >
                                    {status.toolCount > 0 && `${status.toolCount}t`}
                                    {status.resourceCount > 0 && ` ${status.resourceCount}r`}
                                    {status.promptCount > 0 && ` ${status.promptCount}p`}
                                    {status.toolCount === 0 && status.resourceCount === 0 && status.promptCount === 0 && 'no capabilities'}
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

                            {/* Enable/disable toggle button */}
                            <button
                              onClick={async (e) => {
                                console.log('🔄 MCP Toggle button clicked:', server.id, 'currently enabled:', isEnabled);
                                e.preventDefault();
                                e.stopPropagation();

                                // Call toggle function directly
                                await toggleServer(server.id, isEnabled);
                              }}
                              onMouseDown={(e) => {
                                console.log('🔄 MCP Toggle button mousedown:', server.id);
                                // Prevent dropdown from closing
                                e.stopPropagation();
                              }}
                              className={`p-1 rounded transition-colors ${
                                isEnabled
                                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                              }`}
                              title={isEnabled ? 'Click to disable' : 'Click to enable'}
                            >
                              {isEnabled ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </button>
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
