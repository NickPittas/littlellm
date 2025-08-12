/**
 * useAgentManagement Hook - Manages agent state and operations
 * Extracted from ModernChatInterface to reduce component complexity
 */

import { useState, useEffect, useCallback } from 'react';
import { AgentConfiguration } from '../types/agent';
import { agentService } from '../services/agentService';

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

export interface UseAgentManagementReturn {
  // State
  selectedAgent: AgentConfiguration | null;
  availableAgents: AgentConfiguration[];
  premadePrompts: Array<{ title: string; content: string }>;
  
  // Actions
  setSelectedAgent: (agent: AgentConfiguration | null) => void;
  setAvailableAgents: (agents: AgentConfiguration[]) => void;
  setPremadePrompts: (prompts: Array<{ title: string; content: string }>) => void;
  
  // Operations
  loadAgents: () => Promise<void>;
  loadPremadePrompts: () => Promise<void>;
  selectAgent: (agent: AgentConfiguration) => void;
  clearAgent: () => void;
}

export function useAgentManagement(): UseAgentManagementReturn {
  const [selectedAgent, setSelectedAgent] = useState<AgentConfiguration | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AgentConfiguration[]>([]);
  const [premadePrompts, setPremadePrompts] = useState<Array<{ title: string; content: string }>>([]);

  // Load available agents
  const loadAgents = useCallback(async () => {
    try {
      const agents = await agentService.getAgents();
      setAvailableAgents(agents);
      safeDebugLog('info', 'USEAGENTMANAGEMENT', `✅ Loaded ${agents.length} available agents`);
    } catch (error) {
      safeDebugLog('error', 'USEAGENTMANAGEMENT', 'Failed to load agents:', error);
      setAvailableAgents([]);
    }
  }, []);

  // Load premade prompts from file
  const loadPremadePrompts = useCallback(async () => {
    try {
      safeDebugLog('info', 'USEAGENTMANAGEMENT', '🎯 Starting to load premade prompts...');

      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && window.electronAPI) {
        const electronAPI = window.electronAPI as {
          readFile?: (filePath: string) => Promise<string>;
        };

        if (electronAPI.readFile) {
          try {
            const content = await electronAPI.readFile('Premadeprompts.md');
            safeDebugLog('info', 'USEAGENTMANAGEMENT', '📄 Successfully read Premadeprompts.md file');

            // Parse the markdown content to extract prompts
            const prompts = parsePromptsFromMarkdown(content);
            setPremadePrompts(prompts);
            safeDebugLog('info', 'USEAGENTMANAGEMENT', `✅ Loaded ${prompts.length} premade prompts`);
          } catch (error) {
            safeDebugLog('warn', 'USEAGENTMANAGEMENT', 'Failed to read Premadeprompts.md:', error);
            setPremadePrompts([]);
          }
        } else {
          safeDebugLog('warn', 'USEAGENTMANAGEMENT', 'readFile API not available');
          setPremadePrompts([]);
        }
      } else {
        safeDebugLog('info', 'USEAGENTMANAGEMENT', 'Not in Electron environment, skipping premade prompts loading');
        setPremadePrompts([]);
      }
    } catch (error) {
      safeDebugLog('error', 'USEAGENTMANAGEMENT', 'Failed to load premade prompts:', error);
      setPremadePrompts([]);
    }
  }, []);

  // Select an agent
  const selectAgent = useCallback((agent: AgentConfiguration) => {
    setSelectedAgent(agent);
    safeDebugLog('info', 'USEAGENTMANAGEMENT', 'Selected agent:', agent.name);
  }, []);

  // Clear selected agent
  const clearAgent = useCallback(() => {
    setSelectedAgent(null);
    safeDebugLog('info', 'USEAGENTMANAGEMENT', 'Cleared selected agent');
  }, []);

  // Load agents on mount with cleanup
  useEffect(() => {
    let isMounted = true;

    const loadAgentsAsync = async () => {
      if (isMounted) {
        await loadAgents();
      }
    };

    loadAgentsAsync();

    return () => {
      isMounted = false;
    };
  }, [loadAgents]);

  return {
    // State
    selectedAgent,
    availableAgents,
    premadePrompts,
    
    // Actions
    setSelectedAgent,
    setAvailableAgents,
    setPremadePrompts,
    
    // Operations
    loadAgents,
    loadPremadePrompts,
    selectAgent,
    clearAgent
  };
}

/**
 * Parse prompts from markdown content
 */
function parsePromptsFromMarkdown(content: string): Array<{ title: string; content: string }> {
  const prompts: Array<{ title: string; content: string }> = [];
  
  try {
    // Split content by lines
    const lines = content.split('\n');
    let currentTitle = '';
    let currentContent = '';
    let inPromptSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for headers (titles)
      if (trimmedLine.startsWith('#')) {
        // Save previous prompt if we have one
        if (currentTitle && currentContent.trim()) {
          prompts.push({
            title: currentTitle,
            content: currentContent.trim()
          });
        }
        
        // Start new prompt
        currentTitle = trimmedLine.replace(/^#+\s*/, '').trim();
        currentContent = '';
        inPromptSection = true;
      } else if (inPromptSection && trimmedLine) {
        // Add content to current prompt
        currentContent += line + '\n';
      }
    }

    // Don't forget the last prompt
    if (currentTitle && currentContent.trim()) {
      prompts.push({
        title: currentTitle,
        content: currentContent.trim()
      });
    }

    safeDebugLog('info', 'USEAGENTMANAGEMENT', `📝 Parsed ${prompts.length} prompts from markdown`);
  } catch (error) {
    safeDebugLog('error', 'USEAGENTMANAGEMENT', 'Failed to parse prompts from markdown:', error);
  }

  return prompts;
}
