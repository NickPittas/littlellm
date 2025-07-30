// N8N provider implementation

import { BaseProvider } from './BaseProvider';
import { 
  LLMSettings, 
  LLMResponse, 
  MessageContent, 
  ContentItem, 
  LLMProvider,
  ToolObject,
  ProviderCapabilities
} from './types';

import { N8N_SYSTEM_PROMPT, generateN8NToolPrompt } from './prompts/n8n';

export class N8NProvider extends BaseProvider {
  readonly id = 'n8n';
  readonly name = 'n8n Workflow';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'custom'
  };

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    // N8N workflow integration
    console.log(`🔍 N8N sendMessage called with:`, {
      settingsBaseUrl: settings.baseUrl,
      providerBaseUrl: provider.baseUrl,
      messageType: typeof message
    });

    const baseUrl = settings.baseUrl || provider.baseUrl;

    if (!baseUrl) {
      console.error('🚨 N8N webhook URL is missing:', {
        settingsBaseUrl: settings.baseUrl,
        providerBaseUrl: provider.baseUrl,
        hasSettings: !!settings,
        hasProvider: !!provider
      });
      throw new Error('N8N webhook URL is required. Please configure the webhook URL in Settings → API Keys → N8N Base URL.');
    }

    console.log(`🔍 N8N: Using webhook URL: ${baseUrl}`);

    // Prepare the payload for the N8N workflow
    const payload = {
      message: typeof message === 'string' ? message : JSON.stringify(message),
      conversationHistory: conversationHistory.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      settings: {
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt || this.getSystemPrompt()
      },
      conversationId: conversationId || undefined
    };

    console.log('🔗 N8N webhook payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    });

    console.log('🔗 N8N response status:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('🚨 N8N workflow error response:', error);
      throw new Error(`N8N workflow error (${response.status}): ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {
      console.error('❌ No N8N workflow URL provided - cannot fetch models');
      throw new Error('N8N workflow URL is required. Please add the workflow URL in settings.');
    }

    try {
      // For n8n workflows, we don't fetch models from an endpoint
      // Instead, we return a list of workflow names/IDs that the user can configure
      const workflowName = this.extractWorkflowNameFromUrl(baseUrl);
      if (!workflowName) {
        throw new Error('Could not extract workflow name from N8N URL. Please check the URL format.');
      }
      return [workflowName];
    } catch (error) {
      console.error('❌ Failed to process N8N workflow URL:', error);
      throw error instanceof Error ? error : new Error(`Failed to process N8N workflow URL: ${String(error)}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formatTools(_tools: ToolObject[]): unknown[] {
    // N8N workflows handle tools differently
    return [];
  }

  getSystemPrompt(): string {
    return N8N_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolInstructions = generateN8NToolPrompt(tools);
    return basePrompt + toolInstructions;
  }

  // Private helper methods
  private extractWorkflowNameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      // Try to extract a meaningful name from the URL
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        // If it looks like a UUID or hash, use a generic name
        if (lastSegment.match(/^[a-f0-9-]{8,}$/i)) {
          return 'n8n-workflow';
        }
        return lastSegment;
      }
      
      return 'n8n-workflow';
    } catch {
      return null;
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleStreamResponse(
    response: Response,
    _onStream: (chunk: string) => void,
    settings: LLMSettings,
    _provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    _signal?: AbortSignal
  ): Promise<LLMResponse> {
    // N8N streaming would depend on the workflow implementation
    return this.handleNonStreamResponse(response, settings, conversationHistory);
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNonStreamResponse(
    response: Response,
    _settings: LLMSettings,
    _conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    _conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    try {
      // First check if response has content
      const responseText = await response.text();
      console.log('🔗 N8N raw response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyLength: responseText.length,
        bodyPreview: responseText.substring(0, 200)
      });

      if (!responseText.trim()) {
        throw new Error('N8N webhook returned empty response. Check your workflow configuration.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('🚨 N8N JSON parse error:', parseError);
        throw new Error(`N8N webhook returned invalid JSON: ${responseText.substring(0, 100)}...`);
      }

      console.log('🔗 N8N workflow response:', JSON.stringify(data, null, 2));

      // Handle different possible response formats from N8N workflows
      let content = '';
      let usage = undefined;

      if (typeof data === 'string') {
        content = data;
      } else if (data.response) {
        content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
      } else if (data.message) {
        content = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      } else if (data.content) {
        content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
      } else {
        content = JSON.stringify(data);
      }

      // Extract usage information if provided
      if (data.usage) {
        usage = {
          promptTokens: data.usage.promptTokens || data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completionTokens || data.usage.completion_tokens || 0,
          totalTokens: data.usage.totalTokens || data.usage.total_tokens || 0
        };
      } else {
        // Estimate token usage
        const prompt = _conversationHistory.map((msg: {content: string | Array<unknown>}) =>
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        ).join(' ');
        usage = this.createEstimatedUsage(prompt, content, 'N8N estimated');
      }

      return {
        content,
        usage
      };
    } catch (error) {
      console.error('❌ Failed to parse N8N workflow response:', error);
      throw new Error(`Failed to parse N8N workflow response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
