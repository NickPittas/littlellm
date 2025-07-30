// Provider factory for managing LLM providers

import { ILLMProvider } from './BaseProvider';
import { debugLogger } from '../debugLogger';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { MistralProvider } from './MistralProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { DeepinfraProvider } from './DeepinfraProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { OllamaProvider } from './OllamaProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { RequestyProvider } from './RequestyProvider';
import { ReplicateProvider } from './ReplicateProvider';
import { N8NProvider } from './N8NProvider';
// import { MistralProvider } from './MistralProvider';
// import { DeepSeekProvider } from './DeepSeekProvider';
// import { LMStudioProvider } from './LMStudioProvider';
// import { OllamaProvider } from './OllamaProvider';
// import { OpenRouterProvider } from './OpenRouterProvider';
// import { RequestyProvider } from './RequestyProvider';
// import { ReplicateProvider } from './ReplicateProvider';
// import { N8NProvider } from './N8NProvider';

export class ProviderFactory {
  private static providers: Map<string, ILLMProvider> = new Map();

  static {
    // Initialize providers
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new AnthropicProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new MistralProvider());
    this.registerProvider(new DeepSeekProvider());
    this.registerProvider(new DeepinfraProvider());
    this.registerProvider(new LMStudioProvider());
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new OpenRouterProvider());
    this.registerProvider(new RequestyProvider());
    this.registerProvider(new ReplicateProvider());
    this.registerProvider(new N8NProvider());
    // this.registerProvider(new MistralProvider());
    // this.registerProvider(new DeepSeekProvider());
    // this.registerProvider(new LMStudioProvider());
    // this.registerProvider(new OllamaProvider());
    // this.registerProvider(new OpenRouterProvider());
    // this.registerProvider(new RequestyProvider());
    // this.registerProvider(new ReplicateProvider());
    // this.registerProvider(new N8NProvider());
  }

  private static registerProvider(provider: ILLMProvider): void {
    this.providers.set(provider.id, provider);
    debugLogger.info('PROVIDER', `Registered provider: ${provider.id} (${provider.name})`);
  }

  static getProvider(providerId: string): ILLMProvider | null {
    const provider = this.providers.get(providerId);
    if (!provider) {
      console.warn(`⚠️ Provider not found: ${providerId}`);
      return null;
    }
    return provider;
  }

  static getAllProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  static getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  static hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  static getProviderCapabilities(providerId: string) {
    const provider = this.getProvider(providerId);
    return provider?.capabilities;
  }
}

export default ProviderFactory;
