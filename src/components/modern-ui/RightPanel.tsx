'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { mcpService, type MCPServer } from '../../services/mcpService';
import { cn } from '@/lib/utils';

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
interface RightPanelProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  activePanel?: string;
}

export function RightPanel({
  className,
  isOpen = false,
  onClose,
  activePanel
}: RightPanelProps) {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [connectedServers, setConnectedServers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Load MCP servers when panel opens
  useEffect(() => {
    if (isOpen && activePanel === 'mcp-servers') {
      loadMCPServers();
    }
  }, [isOpen, activePanel]);

  const loadMCPServers = async () => {
    setIsLoading(true);
    try {
      const servers = await mcpService.getServers();
      setMcpServers(servers);

      // Get connection status
      const connectedIds = await mcpService.getConnectedServerIds();
      setConnectedServers(new Set(connectedIds));
    } catch (error) {
      safeDebugLog('error', 'RIGHTPANEL', 'Failed to load MCP servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleServer = async (serverId: string, currentEnabled: boolean) => {
    try {
      // Update server enabled status
      const success = await mcpService.updateServer(serverId, { enabled: !currentEnabled });
      if (success) {
        // Reload servers to get updated state
        await loadMCPServers();
      }
    } catch (error) {
      safeDebugLog('error', 'RIGHTPANEL', 'Failed to toggle MCP server:', error);
    }
  };


  const renderPanelContent = () => {
    switch (activePanel) {
      case 'chat-history':
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Chat History</h2>
            <div className="text-gray-400">
              <p>Your conversation history will appear here.</p>
              <p className="text-sm mt-2">Select a conversation to load it in the main chat area.</p>
            </div>
          </div>
        );

      case 'mcp-servers':
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">MCP Servers</h2>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-gray-400">Loading MCP servers...</div>
              </div>
            ) : mcpServers.length === 0 ? (
              <div className="text-gray-400 text-center p-8">
                <p>No MCP servers configured.</p>
                <p className="text-sm mt-2">Configure servers in Settings → MCP.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mcpServers.map((server) => {
                  const isConnected = connectedServers.has(server.id);
                  return (
                    <div
                      key={server.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          server.enabled && isConnected ? "bg-green-500" :
                          server.enabled ? "bg-yellow-500" : "bg-gray-500"
                        )} />
                        <div>
                          <span className="font-medium text-white">{server.name}</span>
                          {server.description && (
                            <p className="text-xs text-gray-400 mt-1">{server.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleServer(server.id, server.enabled)}
                        className={cn(
                          "px-3 py-1 text-xs rounded-md transition-colors",
                          server.enabled
                            ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                            : "bg-gray-600/20 text-gray-400 hover:bg-gray-600/30"
                        )}
                      >
                        {server.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'prompts':
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Prompts</h2>
            <div className="text-gray-400">
              <p>Manage your custom prompts and templates here.</p>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Chat History</h2>
            <div className="text-gray-400">
              <p>View and manage your conversation history here.</p>
            </div>
          </div>
        );

      case 'console':
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Console</h2>
            <div className="text-gray-400">
              <p>Debug console and logs will appear here.</p>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Settings</h2>
            <div className="space-y-6">
              {/* General Settings */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3">General</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Language</span>
                    <select className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white">
                      <option>English</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Theme</span>
                    <select className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white">
                      <option>Dark</option>
                      <option>Light</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Model Settings */}
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Model Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Local Models</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Remote Models</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-6">
            <div className="text-gray-400 text-center">
              <p>Select an item from the sidebar to view its settings.</p>
            </div>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "w-96 bg-gray-900/50 border-l border-gray-800/50 flex flex-col",
        className
      )}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
        <h2 className="text-lg font-semibold text-white">
          {activePanel?.replace('-', ' ').toUpperCase() || 'Panel'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {renderPanelContent()}
      </div>

      {/* Panel Footer - Action buttons */}
      <div className="p-4 border-t border-gray-800/50">
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            Reload
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
