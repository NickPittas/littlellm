'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { MainChatArea } from './MainChatArea';
import { BottomInputArea } from './BottomInputArea';
import { RightPanel } from './RightPanel';
import { SettingsModal } from './SettingsModal';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { FloatingProviderSelector } from './FloatingProviderSelector';
import { AttachmentPreview } from '../AttachmentPreview';
import { AgentManagement } from './AgentManagement';
import { agentService } from '../../services/agentService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

// Import existing services
import { chatService, type ChatSettings, type Message, type ContentItem } from '../../services/chatService';
import type { AgentConfiguration } from '../../types/agent';
import { settingsService } from '../../services/settingsService';
import { conversationHistoryService } from '../../services/conversationHistoryService';
import { secureApiKeyService } from '../../services/secureApiKeyService';

interface ModernChatInterfaceProps {
  className?: string;
}

export function ModernChatInterface({ className }: ModernChatInterfaceProps) {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemma3:gpu');
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [providerSelectorOpen, setProviderSelectorOpen] = useState(false);
  const [providerAnchorElement, setProviderAnchorElement] = useState<HTMLElement | null>(null);
  const [agentManagementOpen, setAgentManagementOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfiguration | null>(null);
  const [availableAgents, setAvailableAgents] = useState<AgentConfiguration[]>([]);

  // Track if user has manually changed provider to avoid init overwrite
  const userChangedProviderRef = useRef(false);
  // Track current provider synchronously for async guards
  const selectedProviderRef = useRef(selectedProvider);
  useEffect(() => {
    selectedProviderRef.current = selectedProvider;
  }, [selectedProvider]);

  // Model instructions and quick prompts state
  const [modelInstructionsOpen, setModelInstructionsOpen] = useState(false);
  const [quickPromptsOpen, setQuickPromptsOpen] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [premadePrompts, setPremadePrompts] = useState<Array<{title: string, content: string}>>([]);
  
  // Settings state
  const [settings, setSettings] = useState<ChatSettings>({
    provider: 'ollama',
    model: 'gemma3:gpu',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
    toolCallingEnabled: false,
    ragEnabled: false,
    providers: {
      openai: { lastSelectedModel: '' },
      anthropic: { lastSelectedModel: '' },
      gemini: { lastSelectedModel: '' },
      mistral: { lastSelectedModel: '' },
      deepseek: { lastSelectedModel: '' },
      deepinfra: { lastSelectedModel: '' },
      groq: { lastSelectedModel: '' },
      lmstudio: { baseUrl: '', lastSelectedModel: '' },
      jan: { baseUrl: '', lastSelectedModel: '' },
      ollama: { baseUrl: '', lastSelectedModel: '' },
      openrouter: { lastSelectedModel: '' },
      requesty: { lastSelectedModel: '' },
      replicate: { lastSelectedModel: '' },
      n8n: { baseUrl: '', lastSelectedModel: '' },
    },
  });

  // Toggle states
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(false);

  // Handle settings updates
  const updateSettings = useCallback((newSettings: Partial<ChatSettings>) => {
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      settingsService.updateChatSettingsInMemory(updatedSettings);
      settingsService.saveSettingsToDisk();
      return updatedSettings;
    });
  }, []); // Remove settings dependency to prevent infinite loop

  // Load models for a specific provider
  const loadModelsForProvider = useCallback(async (providerId: string) => {
    try {
      console.log('Loading models for provider:', providerId);
      setAvailableModels([]); // Clear current models while loading

      // Get API key and base URL from secure storage
      let apiKey = '';
      let baseUrl = '';

      try {
        const apiKeyData = secureApiKeyService?.getApiKeyData(providerId);
        apiKey = apiKeyData?.apiKey || '';
        baseUrl = apiKeyData?.baseUrl || '';
      } catch (error) {
        console.warn(`Failed to get API key data for ${providerId}:`, error);
      }

      // Skip model loading for remote providers without API keys
      if (!apiKey && providerId !== 'ollama' && providerId !== 'lmstudio' && providerId !== 'n8n') {
        console.warn(`No API key found for ${providerId}, skipping model loading`);
        setAvailableModels([]);
        return;
      }

      // Fetch models using the existing chat service
      const models = await chatService.fetchModels(providerId, apiKey, baseUrl);
      console.log(`Loaded ${models.length} models for ${providerId}:`, models);

      // If the provider has changed since this request started, ignore results
      if (providerId !== selectedProviderRef.current) {
        console.log('⏭️ Ignoring models for stale provider load:', providerId, 'current is', selectedProviderRef.current);
        return;
      }

      setAvailableModels(models);

      // Try to restore the last selected model for this provider
      let modelToSelect = '';

      // First, check if there's a saved last selected model for this provider
      try {
        const apiKeyData = secureApiKeyService?.getApiKeyData(providerId);
        const lastSelectedModel = apiKeyData?.lastSelectedModel;

        if (lastSelectedModel && models.includes(lastSelectedModel)) {
          modelToSelect = lastSelectedModel;
          console.log(`✅ Restored last selected model for ${providerId}:`, lastSelectedModel);
        }
      } catch (error) {
        console.warn(`Failed to get last selected model for ${providerId}:`, error);
      }

      // If no valid last selected model, use first available
      if (!modelToSelect && models.length > 0) {
        modelToSelect = models[0];
        console.log(`🔄 Using first available model for ${providerId}:`, modelToSelect);
      }

      // Update the selected model if we found one
      if (modelToSelect) {
        // Guard again in case provider changed while computing model
        if (providerId !== selectedProviderRef.current) {
          console.log('⏭️ Skipping model apply for stale provider:', providerId);
          return;
        }
        setSelectedModel(modelToSelect);
        updateSettings({ model: modelToSelect });
      }
    } catch (error) {
      console.error('Failed to load models for provider:', providerId, error);
      setAvailableModels([]);

      // Add error message to chat if there are existing messages
      if (messages.length > 0) {
        let errorContent = '🤖 **Model Loading Error**: Failed to load models for the selected provider.';

        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();

          if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
            errorContent = `🔑 **Provider Setup Required**: Please configure your API key for ${providerId} in Settings to load available models.`;
          } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            errorContent = `🌐 **Connection Error**: Unable to connect to ${providerId}. Please check your internet connection and provider settings.`;
          } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            errorContent = `❓ **Provider Not Found**: The ${providerId} service is not available. Please check your provider settings.`;
          } else {
            errorContent = `⚠️ **Model Loading Failed**: ${error.message}. Please check your ${providerId} configuration in Settings.`;
          }
        }

        const errorMessage: Message = {
          id: Date.now().toString(),
          content: errorContent,
          role: 'assistant',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, errorMessage]);
      }
    }
  }, [messages.length, updateSettings]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = settingsService.getChatSettings();
        setSettings(savedSettings);

        const provider = savedSettings.provider || 'ollama';
        // Only apply initial provider if user hasn't changed it yet
        if (!userChangedProviderRef.current) {
          setSelectedProvider(provider);
        } else {
          console.log('🛑 Skipping init provider apply; user already changed provider');
        }
        setToolsEnabled(savedSettings.toolCallingEnabled ?? false); // Use nullish coalescing to respect explicit false
        setKnowledgeBaseEnabled(savedSettings.ragEnabled ?? false);

        // Try to get the last selected model for this provider
        let modelToUse = savedSettings.model || 'gemma3:gpu';
        try {
          const apiKeyData = secureApiKeyService?.getApiKeyData(provider);
          const lastSelectedModel = apiKeyData?.lastSelectedModel;
          if (lastSelectedModel) {
            modelToUse = lastSelectedModel;
            console.log(`✅ Restored last selected model for ${provider} on startup:`, lastSelectedModel);
          }
        } catch (error) {
          console.warn(`Failed to get last selected model for ${provider} on startup:`, error);
        }

        // Only apply initial model/load if user hasn't changed provider
        if (!userChangedProviderRef.current) {
          setSelectedModel(modelToUse);
          // Load models for the selected provider (this will validate and potentially update the model)
          await loadModelsForProvider(provider);
        } else {
          console.log('🛑 Skipping init model load; user already changed provider');
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
    loadPremadePrompts();
  }, [loadModelsForProvider]); // Add loadModelsForProvider to dependency array

  // Load available agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = await agentService.getAgents();
        setAvailableAgents(agents);
        console.log(`✅ Loaded ${agents.length} available agents`);
      } catch (error) {
        console.error('Failed to load agents:', error);
        setAvailableAgents([]);
      }
    };

    loadAgents();
  }, []);

  // Handle sidebar item clicks
  const handleSidebarItemClick = (itemId: string) => {
    console.log('Sidebar item clicked:', itemId);

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
          window.electronAPI.openActionMenu();
        }
        break;
      case 'mcp-servers':
        setActivePanel('mcp-servers');
        setRightPanelOpen(true);
        break;
      case 'history':
        // Open the chat history panel (sliding panel from the right)
        setHistoryPanelOpen(true);
        break;
      case 'console':
        // Toggle console window
        if (typeof window !== 'undefined' && window.electronAPI) {
          window.electronAPI.toggleConsoleWindow();
        }
        break;
      case 'add-split-chat':
        console.log('Adding split chat...');
        break;
    }
  };



  // Handle message sending - cloned from VoilaInterface
  const handleSendMessage = async (message: string, providedFiles?: File[]) => {
    if (!message.trim()) return;

    // Use provided files or current attached files
    const filesToSend = providedFiles || attachedFiles;

    // Ensure we have a valid model selected
    if (!selectedModel) {
      console.error('No model selected');
      return;
    }

    // Ensure we have valid settings with the current model and provider
    const currentSettings = {
      ...settings,
      model: selectedModel,
      provider: selectedProvider
    };

    const messageContent = message.trim();

    // Create content array that includes both text and files
    const contentArray: Array<ContentItem> = [];

    // Add text content if present
    if (messageContent) {
      contentArray.push({
        type: 'text',
        text: messageContent
      });
    }

    // Add file content
    for (const file of filesToSend) {
      if (file.type.startsWith('image/')) {
        // Convert image to base64 for display in chat
        const base64 = await chatService.fileToBase64(file);
        contentArray.push({
          type: 'image_url',
          image_url: {
            url: base64
          }
        });
      } else {
        // For non-image files, add a file reference
        contentArray.push({
          type: 'text',
          text: `\n\n[File attached: ${file.name}]`
        });
      }
    }

    // Add user message to messages array
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: contentArray.length === 1 && contentArray[0].type === 'text'
        ? contentArray[0].text || messageContent
        : contentArray,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Clear input and attached files after sending
    setInputValue('');
    setAttachedFiles([]);

    // Sync user message to chat window (but don't auto-open it since we're using the modern interface)
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.syncMessagesToChat(updatedMessages);
      // Note: Not opening chat window since the modern interface is self-contained
    }

    setIsLoading(true); // Start thinking indicator
    console.log('🧠 Started thinking indicator - user message sent');

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Track when we started processing for timeout detection
    const processingStartTime = Date.now();

    // Save conversation immediately after user message
    try {
      const currentConversationId = conversationHistoryService.getCurrentConversationId();
      if (currentConversationId) {
        await conversationHistoryService.updateConversation(currentConversationId, updatedMessages);
      } else {
        const newConversationId = await conversationHistoryService.createNewConversation(updatedMessages);
        conversationHistoryService.setCurrentConversationId(newConversationId);
      }
    } catch (error) {
      console.error('Failed to save conversation after user message:', error);
    }

    try {
      // Create assistant message for streaming
      let assistantContent = '';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      // Add the assistant message immediately for streaming
      setMessages(prev => [...prev, assistantMessage]);

      // Get conversation history (exclude the current user message we just added)
      const conversationHistory = updatedMessages.slice(0, -1); // Exclude the current user message

      const response = await chatService.sendMessage(
        messageContent,
        filesToSend,
        currentSettings,
        conversationHistory,
        (chunk: string) => {
          // Ensure chunk is a string and handle edge cases
          if (typeof chunk !== 'string') {
            console.warn('⚠️ Received non-string chunk in onStream:', typeof chunk, chunk);
            return;
          }

          // Log when streaming starts (first chunk received) and update states properly
          if (assistantContent === '' && chunk.trim().length > 0) {
            const processingDuration = Date.now() - processingStartTime;
            console.log(`🤖 Model started streaming after ${processingDuration}ms, switching to streaming mode`);
            setIsLoading(false); // Stop loading indicator (thinking animation)
            setIsStreaming(true); // Start streaming mode (keep stop button active)
          }

          // Handle streaming response
          assistantContent += chunk;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessage.id
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        },
        controller.signal, // signal
        conversationHistoryService.getCurrentConversationId() || undefined,
        (isSearching: boolean, query?: string) => {
          // Handle knowledge base search indicator
          console.log('🔍 Knowledge base search state changed:', { isSearching, query });
          // TODO: Add knowledge base search indicator to UI
        }
      );

      // Update final response with usage, toolCalls, and sources
      if (!assistantContent) {
        // No streaming occurred, update with full response
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: response.content, usage: response.usage, toolCalls: response.toolCalls, sources: response.sources }
              : msg
          )
        );
      } else {
        // Streaming occurred, just update usage, toolCalls, and sources without changing content
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, usage: response.usage, toolCalls: response.toolCalls, sources: response.sources }
              : msg
          )
        );
      }

      // Stop all indicators when final response is complete
      const totalProcessingTime = Date.now() - processingStartTime;
      console.log(`✅ Final response complete after ${totalProcessingTime}ms, stopping all indicators`);
      setIsLoading(false);
      setIsStreaming(false);

      // Clean up abort controller
      setAbortController(null);

      // Save conversation to history
      const currentConversationId = conversationHistoryService.getCurrentConversationId();
      const finalMessages = [...updatedMessages, { ...assistantMessage, content: response.content, usage: response.usage, toolCalls: response.toolCalls, sources: response.sources }];

      if (currentConversationId) {
        await conversationHistoryService.updateConversation(currentConversationId, finalMessages);
      } else {
        const newConversationId = await conversationHistoryService.createNewConversation(finalMessages);
        conversationHistoryService.setCurrentConversationId(newConversationId);
      }

    } catch (error) {
      console.error('Failed to send message:', error);

      // Check if this was an abort (user stopped generation)
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        console.log('🛑 Request was aborted by user');
        setIsLoading(false);
        setAbortController(null);
        return; // Don't show error message for user-initiated aborts
      }

      // Create user-friendly error message based on error type
      let errorContent = 'Sorry, I encountered an error while processing your message. Please try again.';

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        // Provider-specific errors
        if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
          errorContent = '🔑 **Authentication Error**: Please check your API key in Settings. The provider may require a valid API key to process requests.';
        } else if (errorMessage.includes('tool calling') || errorMessage.includes('function calling')) {
          errorContent = '🔧 **Tool Calling Error**: This provider doesn\'t support tool calling. Please disable tools or switch to a compatible provider like OpenAI, Anthropic, or Ollama.';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
          errorContent = '⏱️ **Rate Limit**: You\'ve exceeded the API rate limit. Please wait a moment before trying again.';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          errorContent = '🌐 **Connection Error**: Unable to connect to the provider. Please check your internet connection and try again.';
        } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
          errorContent = '🤖 **Model Error**: The selected model is not available. Please choose a different model in the dropdown below.';
        } else if (errorMessage.includes('file') || errorMessage.includes('upload')) {
          errorContent = '📁 **File Upload Error**: Failed to process the uploaded file. Please check the file format and try again.';
        } else if (errorMessage.includes('context') || errorMessage.includes('token limit')) {
          errorContent = '📝 **Context Length Error**: Your message is too long for this model. Please try a shorter message or use a model with a larger context window.';
        } else {
          // Generic error with more details
          errorContent = `❌ **Error**: ${error.message}\n\nPlease try again or check your settings if the problem persists.`;
        }
      }

      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: errorContent,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setIsStreaming(false);

      // Clean up abort controller
      setAbortController(null);
    }
  };

  // Handle stopping message generation
  const handleStopGeneration = () => {
    if (abortController && (isLoading || isStreaming)) {
      console.log('🛑 User requested to stop generation');
      abortController.abort();
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);

      // Add a message indicating the generation was stopped
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          return prev.map((msg, index) =>
            index === prev.length - 1
              ? { ...msg, content: msg.content + '\n\n*[Generation stopped by user]*' }
              : msg
          );
        }
        return prev;
      });
    }
  };

  // Handle file upload - simplified to match original behavior
  const handleFileUpload = async (files: FileList) => {
    console.log('Files uploaded:', Array.from(files).map(f => f.name));

    // Add files to attached files list - parsing will be handled by chatService
    const newFiles = Array.from(files);
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  // Handle removing attached files
  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle model change with persistence
  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    console.log('Model changed to:', newModel);

    // Save to general settings
    try {
      const updatedSettings = {
        ...settings,
        model: newModel
      };

      await settingsService.updateSettings({ chat: updatedSettings });
      setSettings(updatedSettings);
      console.log('Model saved to general settings:', newModel);
    } catch (error) {
      console.error('Failed to save model to general settings:', error);
    }

    // Also save as last selected model for current provider
    try {
      if (selectedProvider) {
        const currentApiKeyData = secureApiKeyService?.getApiKeyData(selectedProvider);
        if (currentApiKeyData) {
          await secureApiKeyService.setApiKeyData(selectedProvider, {
            ...currentApiKeyData,
            lastSelectedModel: newModel
          });
        } else {
          await secureApiKeyService.setApiKeyData(selectedProvider, {
            apiKey: '',
            baseUrl: '',
            lastSelectedModel: newModel
          });
        }
        console.log(`✅ Saved last selected model for ${selectedProvider}:`, newModel);
      }
    } catch (error) {
      console.error('Failed to save last selected model for provider:', error);
    }
  };


  // Test function for screenshot (can be called from console)
  if (typeof window !== 'undefined') {
    (window as unknown as { testScreenshot: () => Promise<{ success: boolean; dataURL?: string; error?: string }> }).testScreenshot = async () => {
    console.log('🧪 Testing screenshot functionality...');
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.takeScreenshot();
        console.log('🧪 Test result:', result);
        return result;
      } else {
        console.log('🧪 electronAPI not available');
        return { success: false, error: 'electronAPI not available' };
      }
    } catch (error) {
      console.error('🧪 Test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
  }

  // Handle screenshot - enhanced with better feedback
  const handleScreenshot = async () => {
    try {
      console.log('📸 Screenshot button clicked');

      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('📸 Calling electronAPI.takeScreenshot...');
        const result = await window.electronAPI.takeScreenshot();
        console.log('📸 Screenshot result:', { success: result.success, hasDataURL: !!result.dataURL, error: result.error });

        if (typeof result === 'object' && result.success && result.dataURL) {
          console.log('📸 Converting screenshot to file...');
          const response = await fetch(result.dataURL);
          const blob = await response.blob();
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });

          console.log(`📸 Screenshot file created: ${file.name} (${Math.round(file.size / 1024)}KB)`);

          // Auto-attach screenshot to chat
          setAttachedFiles(prev => [...prev, file]);
          console.log('✅ Screenshot captured and attached to chat');

          // Show a brief success indicator
          const successMsg = document.createElement('div');
          successMsg.textContent = '📸 Screenshot captured!';
          successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          `;
          document.body.appendChild(successMsg);
          setTimeout(() => document.body.removeChild(successMsg), 2000);

        } else {
          throw new Error(result.error || 'Screenshot capture failed');
        }
      } else {
        throw new Error('Screenshot functionality is not available in this environment');
      }
    } catch (error) {
      console.error('❌ Failed to take screenshot:', error);

      // Show error notification
      const errorMsg = document.createElement('div');
      errorMsg.textContent = `❌ Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errorMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-width: 300px;
      `;
      document.body.appendChild(errorMsg);
      setTimeout(() => document.body.removeChild(errorMsg), 4000);
    }
  };



  // Handle toggle states
  const handleToggleTools = (enabled: boolean) => {
    setToolsEnabled(enabled);
    updateSettings({ toolCallingEnabled: enabled });
  };

  const handleToggleMCP = (enabled: boolean) => {
    setMcpEnabled(enabled);
    // MCP settings are managed separately, not through chat settings
    console.log('MCP toggled:', enabled);
  };

  const handleToggleKnowledgeBase = (enabled: boolean) => {
    setKnowledgeBaseEnabled(enabled);
    updateSettings({ ragEnabled: enabled });
  };

  // Handle provider selection
  const handleProviderSelect = async (providerId: string) => {
    console.log('Provider selected:', providerId);
    userChangedProviderRef.current = true;
    setSelectedProvider(providerId);
    updateSettings({ provider: providerId });

    // Load models for the selected provider (this will restore the last selected model)
    await loadModelsForProvider(providerId);
  };

  // Handle provider selector opening
  const handleProviderClick = (element: HTMLElement) => {
    setProviderAnchorElement(element);
    setProviderSelectorOpen(true);
  };

  // Handle agent selection from management interface
  const handleAgentSelect = async (agent: AgentConfiguration) => {
    try {
      console.log('🤖 Agent selected from management:', agent.name);

      // Set the selected agent
      setSelectedAgent(agent);

      // Update settings with agent configuration
      setSettings(prev => ({
        ...prev,
        provider: agent.defaultProvider,
        model: agent.defaultModel,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature || 0.7,
        maxTokens: agent.maxTokens || 4000,
        toolCallingEnabled: agent.toolCallingEnabled
      }));

      // Set selected provider and model
      userChangedProviderRef.current = true;
      setSelectedProvider(agent.defaultProvider);
      setSelectedModel(agent.defaultModel);

      // Load models for the provider
      await loadModelsForProvider(agent.defaultProvider);

      // Start a new chat with the agent configuration
      handleStartNewChat();

      console.log('✅ Agent configuration applied successfully');
    } catch (error) {
      console.error('❌ Failed to apply agent configuration:', error);
    }
  };

  // Handle agent change from dropdown
  const handleAgentChange = async (agent: AgentConfiguration | null) => {
    try {
      console.log('🤖 Agent changed from dropdown:', agent?.name || 'No Agent');

      setSelectedAgent(agent);

      if (agent) {
        // Apply agent configuration
        setSettings(prev => ({
          ...prev,
          provider: agent.defaultProvider,
          model: agent.defaultModel,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature || 0.7,
          maxTokens: agent.maxTokens || 4000,
          toolCallingEnabled: agent.toolCallingEnabled
        }));

        userChangedProviderRef.current = true;
        setSelectedProvider(agent.defaultProvider);
        setSelectedModel(agent.defaultModel);
        await loadModelsForProvider(agent.defaultProvider);
      } else {
        // Clear agent configuration - preserve user's tool calling preference
        const savedSettings = settingsService.getChatSettings();
        setSettings(prev => ({
          ...prev,
          systemPrompt: '',
          temperature: 0.7,
          maxTokens: 4000,
          toolCallingEnabled: savedSettings.toolCallingEnabled // Preserve user's preference
        }));
      }

      console.log('✅ Agent change applied successfully');
    } catch (error) {
      console.error('❌ Failed to apply agent change:', error);
    }
  };

  // Load premade prompts from file
  const loadPremadePrompts = async () => {
    try {
      console.log('🎯 Starting to load premade prompts...');

      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('🎯 Electron API available, attempting to read file...');

        // Try different file path formats
        const possiblePaths = [
          'z:\\Python\\AI Assistant\\littlellm\\docs\\Premadeprompts.md',
          'Z:\\Python\\AI Assistant\\littlellm\\docs\\Premadeprompts.md',
          './docs/Premadeprompts.md',
          'docs/Premadeprompts.md'
        ];

        let promptsContent = '';
        let successfulPath = '';

        for (const path of possiblePaths) {
          try {
            console.log(`🎯 Trying to read file from: ${path}`);
            const fileData = await window.electronAPI.readFile(path);

            // Handle the new API response format
            if (fileData && fileData.success && fileData.content) {
              promptsContent = fileData.content;
              successfulPath = path;
              console.log(`🎯 Successfully read file from: ${path}, content length: ${promptsContent.length}`);
              break;
            } else if (fileData && !fileData.success) {
              console.log(`🎯 Failed to read from ${path}: ${fileData.error}`);
              continue;
            }
          } catch (pathError) {
            console.log(`🎯 Failed to read from ${path}:`, pathError);
            continue;
          }
        }

        if (!promptsContent) {
          console.error('🎯 Failed to read prompts file from any path');
          setPremadePrompts([]);
          return;
        }

        // Parse prompts from the structured content (title: "..." prompt: "...")
        console.log('🎯 Parsing prompts from structured content...');
        const lines = promptsContent.split('\n');
        const prompts: Array<{title: string, content: string}> = [];

        let currentTitle = '';
        let currentPrompt = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]?.trim();

          // Skip empty lines
          if (!line) continue;

          // Check for title line (with or without quotes)
          if (line.startsWith('title')) {
            // Extract title - handle both "title: Title" and "title: "Title""
            let titleMatch = line.match(/title:?\s*"(.+)"/); // With quotes
            if (!titleMatch) {
              titleMatch = line.match(/title:?\s*(.+)/); // Without quotes
            }
            if (titleMatch) {
              currentTitle = titleMatch[1].trim();
            }
          }

          // Check for prompt line (with or without quotes)
          else if (line.startsWith('prompt:')) {
            // Extract prompt - handle both formats
            let promptMatch = line.match(/prompt:\s*"(.+)"/); // With quotes
            if (!promptMatch) {
              promptMatch = line.match(/prompt:\s*(.+)/); // Without quotes
            }
            if (promptMatch) {
              currentPrompt = promptMatch[1].trim();

              // If we have both title and prompt, add to prompts array
              if (currentTitle && currentPrompt) {
                prompts.push({
                  title: currentTitle,
                  content: currentPrompt
                });
                console.log(`🎯 Found prompt: ${currentTitle}`);

                // Reset for next prompt
                currentTitle = '';
                currentPrompt = '';
              }
            }
          }
        }

        setPremadePrompts(prompts);
        console.log('🎯 Successfully loaded', prompts.length, 'premade prompts from', successfulPath);
      } else {
        console.error('🎯 Electron API not available');
      }
    } catch (error) {
      console.error('🎯 Failed to load premade prompts:', error);
      setPremadePrompts([]);
    }
  };

  // Handle model instructions editing
  const handleEditModelInstructions = () => {
    setCustomSystemPrompt('');
    setModelInstructionsOpen(true);
  };

  // Apply custom prompt as system prompt (enhances existing system prompt)
  const handleApplyModelInstructions = async () => {
    if (customSystemPrompt.trim()) {
      try {
        // Combine with existing system prompt if any
        const existingSystemPrompt = settings.systemPrompt || '';
        const combinedSystemPrompt = existingSystemPrompt
          ? `${existingSystemPrompt}\n\n## Additional Instructions\n${customSystemPrompt.trim()}`
          : customSystemPrompt.trim();

        const updatedSettings = {
          ...settings,
          systemPrompt: combinedSystemPrompt
        };

        await settingsService.updateSettings({ chat: updatedSettings });
        setSettings(updatedSettings);
        setModelInstructionsOpen(false);
        setCustomSystemPrompt('');

        console.log('Custom prompt applied as system prompt:', combinedSystemPrompt.substring(0, 100) + '...');
      } catch (error) {
        console.error('Failed to apply custom prompt:', error);
      }
    }
  };

  // Clear system prompt
  const handleClearSystemPrompt = async () => {
    try {
      const updatedSettings = {
        ...settings,
        systemPrompt: ''
      };

      await settingsService.updateSettings({ chat: updatedSettings });
      setSettings(updatedSettings);

      console.log('System prompt cleared');
    } catch (error) {
      console.error('Failed to clear system prompt:', error);
    }
  };

  // Handle quick prompt selection (apply as system prompt)
  const handleQuickPromptSelect = async (prompt: {title: string, content: string}) => {
    try {
      // Combine with existing system prompt if any
      const existingSystemPrompt = settings.systemPrompt || '';
      const combinedSystemPrompt = existingSystemPrompt
        ? `${existingSystemPrompt}\n\n## ${prompt.title} Mode\n${prompt.content}`
        : prompt.content;

      const updatedSettings = {
        ...settings,
        systemPrompt: combinedSystemPrompt
      };

      await settingsService.updateSettings({ chat: updatedSettings });
      setSettings(updatedSettings);
      setQuickPromptsOpen(false);

      console.log(`Quick prompt "${prompt.title}" applied as system prompt:`, combinedSystemPrompt.substring(0, 100) + '...');
    } catch (error) {
      console.error('Failed to apply quick prompt:', error);
    }
  };



  // Handle chat history selection
  const handleChatSelect = async (chatId: string) => {
    console.log('Selected chat:', chatId);
    try {
      // Load the selected conversation from the history service
      const conversation = await conversationHistoryService.getConversation(chatId);
      if (conversation) {
        // Set the messages state to the conversation's messages
        setMessages(conversation.messages);
        // Set the current conversation ID
        conversationHistoryService.setCurrentConversationId(chatId);
        console.log(`Loaded conversation "${conversation.title}" with ${conversation.messages.length} messages`);
      } else {
        console.error('Conversation not found:', chatId);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // Handle starting a new chat
  const handleStartNewChat = async () => {
    console.log('Starting new chat...');

    // Clear messages
    setMessages([]);

    // Clear input and attached files
    setInputValue('');
    setAttachedFiles([]);

    // Reset system prompt to empty for new chat
    try {
      const updatedSettings = {
        ...settings,
        systemPrompt: ''
      };

      await settingsService.updateSettings({ chat: updatedSettings });
      setSettings(updatedSettings);
      console.log('System prompt reset for new chat');
    } catch (error) {
      console.error('Failed to reset system prompt:', error);
    }

    // Clear conversation state for providers that maintain server-side context (like Ollama)
    try {
      if (settings.provider === 'ollama') {
        console.log('🧹 Clearing Ollama conversation state for fresh start...');
        await chatService.clearConversationState(settings);
      }
    } catch (error) {
      console.error('Failed to clear conversation state:', error);
      // Don't block the new chat if this fails
    }

    // Clear the current conversation ID
    conversationHistoryService.setCurrentConversationId(null);

    // Clear localStorage for chat window
    localStorage.removeItem('chatWindowMessages');

    // Sync empty state to chat window
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.syncMessagesToChat([]);
    }

    console.log('New chat started - all state cleared');
  };

  // Listen for prompt selections from action menu overlay
  useEffect(() => {
    console.log('🎯 Setting up prompt selection listener in ModernChatInterface');

    if (typeof window !== 'undefined' && window.electronAPI) {
      const handlePromptSelected = async (promptText: string) => {
        console.log('🎯 ModernChatInterface received prompt from action menu:', promptText);

        let processedPrompt = promptText;

        // If the prompt contains {content} placeholder, replace it with clipboard content
        if (promptText.includes('{content}')) {
          try {
            console.log('🎯 Prompt contains {content}, reading clipboard...');
            const clipboardContent = await window.electronAPI.readClipboard();

            if (clipboardContent && clipboardContent.trim()) {
              processedPrompt = promptText.replace('{content}', clipboardContent.trim());
              console.log('🎯 Replaced {content} with clipboard content');
            } else {
              processedPrompt = promptText.replace('{content}', '[No clipboard content available]');
              console.log('🎯 No clipboard content available, using placeholder');
            }
          } catch (error) {
            console.error('🎯 Failed to read clipboard:', error);
            processedPrompt = promptText.replace('{content}', '[Clipboard access failed]');
          }
        }

        // Set the processed prompt in the input field
        setInputValue(processedPrompt);
        console.log('🎯 ModernChatInterface set input with processed prompt:', processedPrompt);
      };

      console.log('🎯 Registering onPromptSelected listener');
      window.electronAPI.onPromptSelected?.(handlePromptSelected);

      return () => {
        console.log('🎯 Cleaning up prompt selection listener');
        window.electronAPI.removeAllListeners('prompt-selected');
      };
    } else {
      console.warn('🎯 electronAPI not available for prompt selection');
    }
  }, []); // Empty dependency array - only setup once



  return (
    <div
      className={cn(
        "flex h-screen bg-gray-950 text-white overflow-hidden modern-chat-interface",
        className
      )}
      style={{
        borderRadius: '32px',
        overflow: 'hidden'
      }}
    >
      {/* Left Sidebar */}
      <LeftSidebar
        onItemClick={handleSidebarItemClick}
        selectedProvider={selectedProvider}
        onProviderClick={handleProviderClick}
        className="flex-shrink-0"
      />

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Native Windows title bar provides drag; no custom header */}

        {/* Chat Area */}
        <MainChatArea
          selectedModel={selectedModel}
          messages={messages}
          isLoading={isLoading}
          onEditModelInstructions={handleEditModelInstructions}
          onQuickPrompts={() => setQuickPromptsOpen(true)}
          className="flex-1"
        />

        {/* Attachment Preview */}
        {attachedFiles.length > 0 && (
          <div className="px-4 pb-2">
            <AttachmentPreview
              files={attachedFiles}
              onRemoveFile={handleRemoveFile}
            />
          </div>
        )}

        {/* Bottom Input */}
        <BottomInputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          onStop={handleStopGeneration}
          onFileUpload={handleFileUpload}
          onScreenshot={handleScreenshot}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          availableModels={availableModels}
          selectedProvider={selectedProvider}
          isLoading={isLoading || isStreaming}
          toolsEnabled={toolsEnabled}
          onToggleTools={handleToggleTools}
          mcpEnabled={mcpEnabled}
          onToggleMCP={handleToggleMCP}
          knowledgeBaseEnabled={knowledgeBaseEnabled}
          onToggleKnowledgeBase={handleToggleKnowledgeBase}
          onStartNewChat={handleStartNewChat}
          selectedAgent={selectedAgent}
          onAgentChange={handleAgentChange}
          availableAgents={availableAgents}
          className="flex-shrink-0"
        />
      </div>

      {/* Right Panel */}
      <RightPanel
        isOpen={rightPanelOpen}
        activePanel={activePanel}
        onClose={() => setRightPanelOpen(false)}
        className="flex-shrink-0"
      />

      {/* Settings Modal Overlay */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSettingsModalOpen(false)}
          />

          {/* Settings Modal */}
          <div className="relative w-[90vw] h-[90vh] max-w-6xl max-h-[800px] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <SettingsModal
              isOpen={settingsModalOpen}
              onClose={() => setSettingsModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Chat History Panel */}
      <ChatHistoryPanel
        isOpen={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
        onSelectChat={handleChatSelect}
      />

      {/* Agent Management Modal */}
      {agentManagementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setAgentManagementOpen(false)}
          />

          {/* Agent Management Modal */}
          <div className="relative w-[95vw] h-[95vh] max-w-7xl max-h-[900px] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <AgentManagement
              onAgentSelect={handleAgentSelect}
              onClose={() => setAgentManagementOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Floating Provider Selector */}
      <FloatingProviderSelector
        isOpen={providerSelectorOpen}
        onClose={() => setProviderSelectorOpen(false)}
        onProviderSelect={handleProviderSelect}
        selectedProvider={selectedProvider}
        anchorElement={providerAnchorElement}
      />

      {/* Model Instructions Dialog */}
      <Dialog open={modelInstructionsOpen} onOpenChange={setModelInstructionsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">Custom Prompt</Label>
              <Textarea
                id="system-prompt"
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                placeholder="Enter your custom prompt here..."
                rows={8}
                className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
              />
              <p className="text-sm text-muted-foreground">
                This prompt will be applied as a system prompt to enhance the AI&apos;s behavior. It will be combined with existing system prompts and tool instructions.
              </p>
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleClearSystemPrompt}
                className="text-red-400 hover:text-red-300"
              >
                Clear System Prompt
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setModelInstructionsOpen(false);
                    setCustomSystemPrompt('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleApplyModelInstructions}>
                  Apply Prompt
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Prompts Dialog */}
      <Dialog open={quickPromptsOpen} onOpenChange={setQuickPromptsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Quick Prompts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a pre-made prompt to enhance the AI&apos;s behavior as a system prompt. These will be combined with existing system prompts and tool instructions.
            </p>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {premadePrompts.map((prompt, index) => (
                <div
                  key={index}
                  className="p-3 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleQuickPromptSelect(prompt)}
                >
                  <div className="font-medium text-sm mb-1">{prompt.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {prompt.content}
                  </div>
                </div>
              ))}
              {premadePrompts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading prompts...
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleClearSystemPrompt}
                className="text-red-400 hover:text-red-300"
              >
                Clear System Prompt
              </Button>
              <Button
                variant="outline"
                onClick={() => setQuickPromptsOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
