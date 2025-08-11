// Service for managing Llama.cpp models and llama-swap proxy

// Browser-compatible service that communicates with Electron main process

export interface LlamaCppModel {
  id: string;
  name: string;
  description?: string;
  filePath: string;
  size: number;
  parameters: LlamaCppParameters;
  isDownloaded: boolean;
  isRunning: boolean;
}

export interface LlamaCppParameters {
  contextSize?: number;
  threads?: number;
  gpuLayers?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  repeatPenalty?: number;
  batchSize?: number;
  port?: number;
  host?: string;
  [key: string]: any;
}

export interface LlamaSwapConfig {
  models: Record<string, {
    cmd: string;
    proxy?: string;
    name?: string;
    description?: string;
    env?: string[];
    ttl?: number;
  }>;
  startPort?: number;
  healthCheckTimeout?: number;
  logLevel?: string;
}

class LlamaCppService {
  private models: Map<string, LlamaCppModel> = new Map();

  constructor() {
    this.loadMockModels();
  }

  private loadMockModels(): void {
    // For now, load some mock models for demonstration
    const mockModels: LlamaCppModel[] = [
      {
        id: 'phi-3-mini-4k-instruct-q4',
        name: 'Phi-3 Mini 4K Instruct (Q4_K_M)',
        description: 'Small but capable model from Microsoft',
        filePath: '/models/phi-3-mini-4k-instruct-q4_k_m.gguf',
        size: 2300000000, // ~2.3GB
        parameters: this.getDefaultParameters(),
        isDownloaded: false,
        isRunning: false
      },
      {
        id: 'qwen2-5-0-5b-instruct-q4',
        name: 'Qwen2.5 0.5B Instruct (Q4_K_M)',
        description: 'Very small and fast model for basic tasks',
        filePath: '/models/qwen2.5-0.5b-instruct-q4_k_m.gguf',
        size: 350000000, // ~350MB
        parameters: this.getDefaultParameters(),
        isDownloaded: false,
        isRunning: false
      }
    ];

    for (const model of mockModels) {
      this.models.set(model.id, model);
    }
  }

  private getDefaultParameters(): LlamaCppParameters {
    return {
      contextSize: 4096,
      threads: -1,
      gpuLayers: 0,
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      repeatPenalty: 1.1,
      batchSize: 512,
      port: 8080,
      host: '127.0.0.1'
    };
  }

  async getModels(): Promise<LlamaCppModel[]> {
    try {
      // Call Electron IPC to get models
      if (typeof window !== 'undefined' && window.electronAPI) {
        const models = await window.electronAPI.llamaCppGetModels();
        return models as LlamaCppModel[] || [];
      }
      // Fallback to mock data if not in Electron
      return Array.from(this.models.values());
    } catch (error) {
      console.error('Failed to get models from Electron:', error);
      return Array.from(this.models.values());
    }
  }

  async getModel(modelId: string): Promise<LlamaCppModel | null> {
    return this.models.get(modelId) || null;
  }

  async updateModelParameters(modelId: string, parameters: Partial<LlamaCppParameters>): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.llamaCppUpdateModelParameters(modelId, parameters);
      } else {
        // Fallback for non-Electron environment
        const model = this.models.get(modelId);
        if (model) {
          model.parameters = { ...model.parameters, ...parameters };
          this.models.set(modelId, model);
        }
      }
    } catch (error) {
      console.error('Failed to update model parameters:', error);
      throw error;
    }
  }

  async downloadModel(huggingFaceRepo: string, quantization: string = 'Q4_K_M'): Promise<string> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.llamaCppDownloadModel(huggingFaceRepo, quantization);
        if (!result.success) {
          throw new Error(result.error || 'Failed to download model');
        }
        return `${huggingFaceRepo.split('/').pop()}-${quantization}`;
      } else {
        // Fallback for non-Electron environment
        throw new Error('Model downloading not yet implemented. Please manually place .gguf files in the models directory.');
      }
    } catch (error) {
      console.error('Failed to download model:', error);
      throw error;
    }
  }

  async startLlamaSwap(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.llamaCppStartSwap();
        if (!result.success) {
          throw new Error(result.error || 'Failed to start llama-swap');
        }
        console.log('✅ Llama-swap started successfully');
      } else {
        // Fallback for non-Electron environment
        console.log('🚀 Starting llama-swap proxy...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Llama-swap started successfully');
      }
    } catch (error) {
      console.error('Failed to start llama-swap:', error);
      throw error;
    }
  }

  async stopLlamaSwap(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.llamaCppStopSwap();
        if (!result.success) {
          throw new Error(result.error || 'Failed to stop llama-swap');
        }
        console.log('✅ Llama-swap stopped successfully');
      } else {
        // Fallback for non-Electron environment
        console.log('🛑 Stopping llama-swap proxy...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ Llama-swap stopped successfully');
      }
    } catch (error) {
      console.error('Failed to stop llama-swap:', error);
      throw error;
    }
  }

  async isLlamaSwapRunning(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.llamaCppIsSwapRunning();
      }
      // Fallback for non-Electron environment
      return false;
    } catch (error) {
      console.error('Failed to check llama-swap status:', error);
      return false;
    }
  }

  async getAvailableModelsFromHuggingFace(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    downloads: number;
    quantizations: string[];
    size?: Record<string, string>;
  }>> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const models = await window.electronAPI.llamaCppGetAvailableModels();
        return models as Array<{
          id: string;
          name: string;
          description: string;
          downloads: number;
          quantizations: string[];
          size?: Record<string, string>;
        }>;
      } else {
        // Fallback for non-Electron environment
        return [
          {
            id: 'microsoft/Phi-3-mini-4k-instruct-gguf',
            name: 'Phi-3 Mini 4K Instruct',
            description: 'Small but capable model from Microsoft',
            downloads: 50000,
            quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0', 'F16']
          },
          {
            id: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
            name: 'Qwen2.5 0.5B Instruct',
            description: 'Very small and fast model for basic tasks',
            downloads: 30000,
            quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0']
          },
          {
            id: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
            name: 'Llama 3.2 3B Instruct',
            description: 'Efficient model from Meta',
            downloads: 75000,
            quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0']
          }
        ];
      }
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.llamaCppDeleteModel(modelId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete model');
        }
        console.log(`🗑️ Deleted model: ${modelId}`);
      } else {
        // Fallback for non-Electron environment
        this.models.delete(modelId);
        console.log(`🗑️ Deleted model: ${modelId}`);
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      throw error;
    }
  }
}

export const llamaCppService = new LlamaCppService();
