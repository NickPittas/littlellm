'use client';

import { useState, useEffect } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { TopHeader } from './TopHeader';
import { MainChatArea } from './MainChatArea';
import { BottomInputArea } from './BottomInputArea';
import { RightPanel } from './RightPanel';
import { SettingsModal } from './SettingsModal';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { FloatingProviderSelector } from './FloatingProviderSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

// Import existing services
import { chatService, type ChatSettings, type Message } from '../../services/chatService';
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
  const [selectedModel, setSelectedModel] = useState('gemma3:gpu');
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [providerSelectorOpen, setProviderSelectorOpen] = useState(false);
  const [providerAnchorElement, setProviderAnchorElement] = useState<HTMLElement | null>(null);

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
      groq: { lastSelectedModel: '' },
      lmstudio: { baseUrl: '', lastSelectedModel: '' },
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

  // Load models for a specific provider
  const loadModelsForProvider = async (providerId: string) => {
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

      setAvailableModels(models);

      // If current model is not available in new provider, select first available
      if (models.length > 0 && !models.includes(selectedModel)) {
        setSelectedModel(models[0]);
        // Update settings with new model
        updateSettings({ model: models[0] });
      } else if (models.length > 0 && !selectedModel) {
        // If no model is selected at all, select the first one
        setSelectedModel(models[0]);
        updateSettings({ model: models[0] });
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
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await settingsService.getChatSettings();
        setSettings(savedSettings);
        setSelectedModel(savedSettings.model || 'gemma3:gpu');
        setSelectedProvider(savedSettings.provider || 'ollama');
        setToolsEnabled(savedSettings.toolCallingEnabled || false);
        setKnowledgeBaseEnabled(savedSettings.ragEnabled || false);

        // Load models for the selected provider
        await loadModelsForProvider(savedSettings.provider || 'ollama');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
    loadPremadePrompts();
  }, []); // Remove the dependency to prevent infinite loop

  // Handle sidebar item clicks
  const handleSidebarItemClick = (itemId: string) => {
    console.log('Sidebar item clicked:', itemId);

    // Handle different sidebar actions
    switch (itemId) {
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
  const handleSendMessage = async (message: string, attachedFiles: File[] = []) => {
    if (!message.trim()) return;

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

    // Add user message to messages array
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Sync user message to chat window (but don't auto-open it since we're using the modern interface)
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.syncMessagesToChat(updatedMessages);
      // Note: Not opening chat window since the modern interface is self-contained
    }

    setIsLoading(true); // Start thinking indicator
    console.log('🧠 Started thinking indicator - user message sent');

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
        attachedFiles,
        currentSettings,
        conversationHistory,
        (chunk: string) => {
          // Ensure chunk is a string and handle edge cases
          if (typeof chunk !== 'string') {
            console.warn('⚠️ Received non-string chunk in onStream:', typeof chunk, chunk);
            return;
          }

          // Stop thinking indicator when streaming starts (first chunk received)
          if (assistantContent === '' && chunk.trim().length > 0) {
            const processingDuration = Date.now() - processingStartTime;
            console.log(`🤖 Model started streaming after ${processingDuration}ms, stopping thinking indicators`);
            setIsLoading(false);
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
        undefined, // signal
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

      // Stop thinking indicator when final response is complete
      if (isLoading) {
        const totalProcessingTime = Date.now() - processingStartTime;
        console.log(`✅ Final response complete after ${totalProcessingTime}ms, stopping thinking indicator`);
        setIsLoading(false);
      }

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
    }
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList) => {
    console.log('Files uploaded:', files);

    try {
      // Validate file types and sizes
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'application/pdf'];

      for (const file of Array.from(files)) {
        if (file.size > maxFileSize) {
          throw new Error(`File "${file.name}" is too large. Maximum size is 10MB.`);
        }

        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File type "${file.type}" is not supported. Please use images, text files, or PDFs.`);
        }
      }

      // Process files (implement actual upload logic here)
      console.log('Files validated successfully');

    } catch (error) {
      console.error('File upload error:', error);

      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `📁 **File Upload Error**: ${error instanceof Error ? error.message : 'Failed to upload files. Please try again.'}`,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Handle screenshot
  const handleScreenshot = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.takeScreenshot();
        if (typeof result === 'object' && result.success && result.dataURL) {
          console.log('Screenshot taken successfully');
          // Handle screenshot data
        } else {
          throw new Error('Screenshot capture failed');
        }
      } else {
        throw new Error('Screenshot functionality is not available in this environment');
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);

      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `📸 **Screenshot Error**: ${error instanceof Error ? error.message : 'Failed to take screenshot. Please try again.'}`,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Handle settings updates
  const updateSettings = (newSettings: Partial<ChatSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    settingsService.updateChatSettingsInMemory(updatedSettings);
    settingsService.saveSettingsToDisk();
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
    setSelectedProvider(providerId);
    updateSettings({ provider: providerId });

    // Load models for the selected provider
    await loadModelsForProvider(providerId);
  };

  // Handle provider selector opening
  const handleProviderClick = (element: HTMLElement) => {
    setProviderAnchorElement(element);
    setProviderSelectorOpen(true);
  };

  // Load premade prompts from file
  const loadPremadePrompts = async () => {
    try {
      console.log('🎯 Starting to load premade prompts...');

      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('🎯 Electron API available, attempting to read file...');

        // Try different file path formats
        const possiblePaths = [
          'z:\\Python\\AI Assistant\\littlellm\\Premadeprompts.md',
          'Z:\\Python\\AI Assistant\\littlellm\\Premadeprompts.md',
          './Premadeprompts.md',
          'Premadeprompts.md'
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
          // Fallback to hardcoded prompts
          const fallbackPrompts = [
            { title: 'AI Doctor', content: 'I want you to act as an AI assisted doctor. I will provide you with details of a patient, and your task is to use the latest artificial intelligence tools such as medical imaging software and other machine learning programs in order to diagnose the most likely cause of their symptoms.' },
            { title: 'Writing Tutor', content: 'I want you to act as an AI writing tutor. I will provide you with a student who needs help improving their writing and your task is to use artificial intelligence tools, such as natural language processing, to give the student feedback on how they can improve their composition.' },
            { title: 'Academician', content: 'I want you to act as an academician. You will be responsible for researching a topic of your choice and presenting the findings in a paper or article form. Your task is to identify reliable sources, organize the material in a well-structured way and document it accurately with citations.' },
            { title: 'Accountant', content: 'I want you to act as an accountant and come up with creative ways to manage finances. You\'ll need to consider budgeting, investment strategies and risk management when creating a financial plan for your client.' },
            { title: 'Advertiser', content: 'I want you to act as an advertiser. You will create a campaign to promote a product or service of your choice. You will choose a target audience, develop key messages and slogans, select the media channels for promotion, and decide on any additional activities needed to reach your goals.' },
            { title: 'Travel Guide', content: 'I want you to act as a travel guide. I will write you my location and you will suggest a place to visit near my location. In some cases, I will also give you the type of places I will visit.' },
            { title: 'Tech Writer', content: 'I want you to act as a tech writer. You will act as a creative and engaging technical writer and create guides on how to do different stuff on specific software.' },
            { title: 'UX/UI Developer', content: 'I want you to act as a UX/UI developer. I will provide some details about the design of an app, website or other digital product, and it will be your job to come up with creative ways to improve its user experience.' },
            { title: 'Storyteller', content: 'I want you to act as a storyteller. You will come up with entertaining stories that are engaging, imaginative and captivating for the audience.' },
            { title: 'Stand-up Comedian', content: 'I want you to act as a stand-up comedian. I will provide you with some topics related to current events and you will use your wit, creativity, and observational skills to create a routine based on those topics.' }
          ];

          setPremadePrompts(fallbackPrompts);
          console.log('🎯 Using fallback prompts:', fallbackPrompts.length);
          return;
        }

        // Parse prompts from the content
        console.log('🎯 Parsing prompts from content...');
        const lines = promptsContent.split('\n');
        const prompts: Array<{title: string, content: string}> = [];

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('I want you to act as')) {
            // Extract role from "I want you to act as a/an [role]"
            const match = trimmedLine.match(/I want you to act as (?:a |an )?([^.]+)\./);
            if (match) {
              const role = match[1].trim();
              const title = role.charAt(0).toUpperCase() + role.slice(1);
              prompts.push({
                title,
                content: trimmedLine
              });
              console.log(`🎯 Found prompt: ${title}`);
            }
          } else if (trimmedLine.startsWith('You are')) {
            // Extract role from "You are [role]"
            const match = trimmedLine.match(/You are (?:a |an )?([^.]+)\./);
            if (match) {
              const role = match[1].trim();
              const title = role.charAt(0).toUpperCase() + role.slice(1);
              prompts.push({
                title,
                content: trimmedLine
              });
              console.log(`🎯 Found prompt: ${title}`);
            }
          } else if (trimmedLine.startsWith('Your task')) {
            // Extract task type
            const title = `Task Specialist ${prompts.filter(p => p.title.startsWith('Task Specialist')).length + 1}`;
            prompts.push({
              title,
              content: trimmedLine
            });
            console.log(`🎯 Found prompt: ${title}`);
          } else if (trimmedLine.startsWith('Imagine you are')) {
            // Extract role from "Imagine you are [role]"
            const match = trimmedLine.match(/Imagine you are (?:a |an )?([^.]+)\./);
            if (match) {
              const role = match[1].trim();
              const title = role.charAt(0).toUpperCase() + role.slice(1);
              prompts.push({
                title,
                content: trimmedLine
              });
              console.log(`🎯 Found prompt: ${title}`);
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

      // Fallback to hardcoded prompts on error
      const fallbackPrompts = [
        { title: 'AI Doctor', content: 'I want you to act as an AI assisted doctor. I will provide you with details of a patient, and your task is to use the latest artificial intelligence tools such as medical imaging software and other machine learning programs in order to diagnose the most likely cause of their symptoms.' },
        { title: 'Writing Tutor', content: 'I want you to act as an AI writing tutor. I will provide you with a student who needs help improving their writing and your task is to use artificial intelligence tools, such as natural language processing, to give the student feedback on how they can improve their composition.' },
        { title: 'Travel Guide', content: 'I want you to act as a travel guide. I will write you my location and you will suggest a place to visit near my location. In some cases, I will also give you the type of places I will visit.' },
        { title: 'Tech Writer', content: 'I want you to act as a tech writer. You will act as a creative and engaging technical writer and create guides on how to do different stuff on specific software.' },
        { title: 'UX/UI Developer', content: 'I want you to act as a UX/UI developer. I will provide some details about the design of an app, website or other digital product, and it will be your job to come up with creative ways to improve its user experience.' }
      ];

      setPremadePrompts(fallbackPrompts);
      console.log('🎯 Using fallback prompts due to error:', fallbackPrompts.length);
    }
  };

  // Handle model instructions editing
  const handleEditModelInstructions = () => {
    setCustomSystemPrompt(settings.systemPrompt || '');
    setModelInstructionsOpen(true);
  };

  // Save model instructions
  const handleSaveModelInstructions = async () => {
    try {
      const updatedSettings = {
        ...settings,
        systemPrompt: customSystemPrompt
      };

      await settingsService.updateSettings({ chat: updatedSettings });
      setSettings(updatedSettings);
      setModelInstructionsOpen(false);

      console.log('Model instructions saved successfully');
    } catch (error) {
      console.error('Failed to save model instructions:', error);
    }
  };

  // Handle quick prompt selection
  const handleQuickPromptSelect = (prompt: {title: string, content: string}) => {
    setInputValue(prompt.content);
    setQuickPromptsOpen(false);
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

    // Clear input
    setInputValue('');

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

  // Listen for prompt selections from action menu overlay (same as VoilaInterface)
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
        className="flex-shrink-0"
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <TopHeader
          selectedProvider={selectedProvider}
          onProviderClick={handleProviderClick}
          className="flex-shrink-0"
        />

        {/* Chat Area */}
        <MainChatArea
          selectedModel={selectedModel}
          messages={messages}
          isLoading={isLoading}
          onEditModelInstructions={handleEditModelInstructions}
          onQuickPrompts={() => setQuickPromptsOpen(true)}
          className="flex-1"
        />

        {/* Bottom Input */}
        <BottomInputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          onFileUpload={handleFileUpload}
          onScreenshot={handleScreenshot}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          availableModels={availableModels}
          selectedProvider={selectedProvider}
          isLoading={isLoading}
          toolsEnabled={toolsEnabled}
          onToggleTools={handleToggleTools}
          mcpEnabled={mcpEnabled}
          onToggleMCP={handleToggleMCP}
          knowledgeBaseEnabled={knowledgeBaseEnabled}
          onToggleKnowledgeBase={handleToggleKnowledgeBase}
          onStartNewChat={handleStartNewChat}
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
            <DialogTitle>Edit Model Instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea
                id="system-prompt"
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                placeholder="Enter custom instructions for the AI model..."
                rows={8}
                className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
              />
              <p className="text-sm text-muted-foreground">
                This prompt will be sent with every conversation to set the AI behavior and personality.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setModelInstructionsOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveModelInstructions}>
                Save Instructions
              </Button>
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
              Select a pre-made prompt to quickly set up the AI for specific tasks.
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
            <div className="flex justify-end">
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
