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
  // Basic parameters
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

  // Advanced parameters
  flashAttention?: boolean;
  kvCacheQuantization?: string; // 'f16' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1'
  kvCacheQuantizationTypeK?: string; // Same options as above
  kvCacheQuantizationTypeV?: string; // Same options as above

  // Tool calling and template parameters
  jinja?: boolean; // Enable jinja templating for tool calling
  chatTemplate?: string; // Custom chat template

  // Memory and performance
  mlock?: boolean; // Lock model in memory
  noMmap?: boolean; // Disable memory mapping
  numaStrategy?: string; // 'disabled' | 'distribute' | 'isolate' | 'numactl'

  // Sampling parameters
  seed?: number;
  minP?: number;
  tfsZ?: number;
  typicalP?: number;
  mirostat?: number; // 0, 1, or 2
  mirostatTau?: number;
  mirostatEta?: number;

  // Server parameters
  timeout?: number;
  embeddings?: boolean;
  reranking?: boolean;

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
    // No mock models - only show actual downloaded models
  }

  // Removed mock models - only show actual downloaded models

  async getModels(): Promise<LlamaCppModel[]> {
    try {
      console.log('🔍 LlamaCppService.getModels() called');
      console.log('🔍 Window available:', typeof window !== 'undefined');
      console.log('🔍 ElectronAPI available:', typeof window !== 'undefined' && !!window.electronAPI);

      // Call Electron IPC to get models from file system
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.llamaCppGetModels) {
        console.log('📱 Using Electron API to get models from file system');
        try {
          const models = await window.electronAPI.llamaCppGetModels();
          console.log('📱 File system models found:', models);

          if (models && models.length > 0) {
            return models as LlamaCppModel[];
          } else {
            console.log('📱 No models found in file system, checking browser storage...');
          }
        } catch (electronError) {
          console.warn('⚠️ Electron API failed:', electronError);
        }
      }

      // Fallback: In browser mode or if Electron fails, get models from IndexedDB storage
      console.log('🌐 Using browser mode to get models');
      const browserModels = await this.getStoredModelsFromBrowser();

      console.log('🌐 Browser models:', browserModels);

      // Only return downloaded models (no mock models)
      return browserModels;
    } catch (error) {
      console.error('Failed to get models:', error);
      // Return empty array if all methods fail
      return [];
    }
  }

  async getModel(modelId: string): Promise<LlamaCppModel | null> {
    return this.models.get(modelId) || null;
  }

  // Debug method to test IndexedDB storage and retrieval
  async debugIndexedDB(): Promise<void> {
    console.log('🔍 Debug: Testing IndexedDB storage and retrieval...');

    try {
      // Test storage
      const testBlob = new Blob(['test data'], { type: 'application/octet-stream' });
      await this.storeModelInIndexedDB('test-model.gguf', testBlob, 'test/repo');
      console.log('✅ Debug: Test model stored successfully');

      // Test retrieval
      const models = await this.getStoredModelsFromBrowser();
      console.log('📋 Debug: Retrieved models:', models);

      // Clean up test model
      const request = indexedDB.open('LlamaCppModels', 1);
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['models'], 'readwrite');
        const store = transaction.objectStore('models');
        store.delete('test-model.gguf');
        console.log('🧹 Debug: Test model cleaned up');
      };

    } catch (error) {
      console.error('❌ Debug: IndexedDB test failed:', error);
    }
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

  async downloadModel(huggingFaceRepo: string, quantization: string = 'Q4_K_M'): Promise<string | null> {
    try {
      console.log('🔍 Starting model download...');
      console.log('Repository:', huggingFaceRepo);
      console.log('Quantization:', quantization);

      // Validate inputs
      if (!huggingFaceRepo || !huggingFaceRepo.includes('/')) {
        throw new Error('Invalid repository format. Expected format: owner/model-name');
      }

      // Clean up repository name (remove any extra parts)
      const cleanRepo = huggingFaceRepo.split(':')[0]; // Remove quantization if accidentally included
      console.log('Cleaned repository:', cleanRepo);

      // Try Electron API first if available
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.llamaCppDownloadModel) {
        console.log('📥 Using Electron API for download...');
        try {
          const result = await window.electronAPI.llamaCppDownloadModel(cleanRepo, quantization);
          if (!result.success) {
            throw new Error(result.error || 'Failed to download model');
          }
          return result.modelId || `${cleanRepo.split('/').pop()}-${quantization}`;
        } catch (electronError) {
          console.warn('⚠️ Electron API failed, falling back to browser download:', electronError);
          // Fall back to browser download if Electron fails
          return await this.downloadModelInBrowser(cleanRepo, quantization);
        }
      } else {
        // Browser-based download
        console.log('🌐 Using browser-based download...');
        return await this.downloadModelInBrowser(cleanRepo, quantization);
      }
    } catch (error) {
      console.error('❌ Failed to download model:', error);
      throw error;
    }
  }

  private async downloadModelInBrowser(huggingFaceRepo: string, quantization: string): Promise<string | null> {
    try {
      // Validate and normalize quantization
      const validQuantizations = ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'Q8_K_XL', 'F16', 'Q4_0', 'Q5_0', 'Q2_K', 'Q3_K_M', 'Q4_K_S', 'Q5_K_S'];
      let normalizedQuantization = quantization.toUpperCase();

      // Warn about large quantizations for browser downloads
      if (normalizedQuantization === 'Q8_K_XL' || normalizedQuantization === 'F16') {
        console.warn(`⚠️ ${normalizedQuantization} quantization produces very large files that may not work in browser downloads. Consider using Electron app or a smaller quantization like Q4_K_M or Q5_K_M.`);
      }

      if (!validQuantizations.includes(normalizedQuantization)) {
        console.warn(`⚠️ Unknown quantization ${quantization}, will search for any GGUF file`);
        normalizedQuantization = 'Q4_K_M'; // Default fallback
      }

      // First, get the list of files from the repository
      console.log('🔍 Fetching model files from Hugging Face...');
      console.log('🌐 API URL:', `https://huggingface.co/api/models/${huggingFaceRepo}/tree/main`);

      const filesResponse = await fetch(`https://huggingface.co/api/models/${huggingFaceRepo}/tree/main`);

      if (!filesResponse.ok) {
        if (filesResponse.status === 404) {
          throw new Error(`Repository not found: ${huggingFaceRepo}. Please check the repository name.`);
        }
        throw new Error(`Failed to fetch model files: ${filesResponse.status} ${filesResponse.statusText}`);
      }

      const files = await filesResponse.json();
      console.log(`📁 Found ${files.length} files in repository`);

      // Find GGUF files that match the quantization
      const ggufFiles = files.filter((file: any) =>
        file.path.endsWith('.gguf') &&
        file.path.toUpperCase().includes(normalizedQuantization)
      );

      console.log(`🔍 Found ${ggufFiles.length} GGUF files matching ${normalizedQuantization}`);

      if (ggufFiles.length === 0) {
        // If no exact match, find any GGUF file
        const anyGgufFiles = files.filter((file: any) => file.path.endsWith('.gguf'));
        console.log(`📁 Found ${anyGgufFiles.length} total GGUF files`);

        if (anyGgufFiles.length === 0) {
          throw new Error(`No GGUF files found in repository ${huggingFaceRepo}. This may not be a GGUF model repository.`);
        }

        // Use the first GGUF file found
        console.log(`⚠️ No ${normalizedQuantization} quantization found, using: ${anyGgufFiles[0].path}`);
        return await this.downloadFileFromHuggingFace(huggingFaceRepo, anyGgufFiles[0].path);
      }

      // Use the first matching file
      const targetFile = ggufFiles[0];
      console.log(`📥 Found target file: ${targetFile.path}`);

      return await this.downloadFileFromHuggingFace(huggingFaceRepo, targetFile.path);

    } catch (error) {
      console.error('❌ Browser download failed:', error);
      throw new Error(`Browser download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async downloadFileFromHuggingFace(repo: string, filePath: string): Promise<string> {
    try {
      const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${filePath}`;
      console.log(`📥 Downloading from: ${downloadUrl}`);

      // Always use automatic download with progress tracking
      return await this.downloadWithProgressTracking(downloadUrl, filePath, repo);

    } catch (error) {
      console.error('❌ File download failed:', error);
      throw new Error(`File download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async downloadWithProgressTracking(downloadUrl: string, filePath: string, repo: string): Promise<string> {
    try {
      console.log('📥 Starting memory-efficient streaming download...');

      const fileName = filePath.split('/').pop() || 'model.gguf';

      // Create a progress tracking system
      const progressCallback = (progress: number, status: string) => {
        console.log(`📊 Download progress: ${progress}% - ${status}`);
        // Emit progress events that the UI can listen to
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('llamacpp-download-progress', {
            detail: { fileName, progress, status, repo }
          }));
        }
      };

      progressCallback(0, 'Starting download...');

      // Download the file with progress tracking
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      progressCallback(10, 'Preparing download...');

      // Log file size for user information
      if (total > 0) {
        console.log(`📦 Model size: ${this.formatBytes(total)}`);
        if (total > 5 * 1024 * 1024 * 1024) { // 5GB warning
          console.warn(`⚠️ Large model detected (${this.formatBytes(total)}). Download may take a while and use significant memory.`);
        }
      }

      progressCallback(15, 'Starting download...');

      // Use streaming approach with memory management
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      // Use a more memory-efficient approach with streaming
      const stream = new ReadableStream({
        start(controller) {
          const readerRef = reader; // Capture reader to avoid TypeScript issues
          async function pump(): Promise<void> {
            try {
              const { done, value } = await readerRef.read();
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
              return pump();
            } catch (error) {
              controller.error(error);
            }
          }
          return pump();
        }
      });

      // Convert stream to blob using Response constructor (more memory efficient)
      const streamResponse = new Response(stream);
      const blob = await streamResponse.blob();

      progressCallback(90, 'Storing model...');

      // Store the model automatically
      await this.storeModelAutomatically(fileName, blob, repo);

      progressCallback(100, 'Download complete!');

      console.log(`✅ Model downloaded and stored automatically: ${fileName}`);

      // Return a model ID
      const modelId = `${repo.split('/').pop()}-${fileName.replace('.gguf', '')}`;
      return modelId;

    } catch (error) {
      console.error('❌ Automatic download failed:', error);

      // Provide helpful error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('Array buffer allocation failed') ||
            error.message.includes('out of memory') ||
            error.message.includes('Maximum call stack size exceeded')) {
          throw new Error(`Browser download failed: Insufficient memory for this model size. Consider using the Electron app for better memory management, or download manually from: ${downloadUrl}`);
        }
      }

      throw error;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async storeModelAutomatically(fileName: string, blob: Blob, repo: string): Promise<void> {
    try {
      // Store in IndexedDB for immediate availability
      await this.storeModelInIndexedDB(fileName, blob, repo);

      console.log(`💾 Model stored in browser storage automatically`);

      // Temporarily disabled to fix infinite loop
      // // Trigger a models refresh event
      // if (typeof window !== 'undefined') {
      //   console.log('🔄 Triggering models refresh event...');
      //   window.dispatchEvent(new CustomEvent('llamacpp-models-updated', {
      //     detail: { fileName, repo }
      //   }));
      // }
    } catch (error) {
      console.error('❌ Failed to store model automatically:', error);
      throw error;
    }
  }



  private async storeModelInIndexedDB(fileName: string, blob: Blob, repo: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔍 Storing model in IndexedDB: ${fileName} (${blob.size} bytes) from ${repo}`);
      const request = indexedDB.open('LlamaCppModels', 1);

      request.onerror = (event) => {
        console.error('❌ Failed to open IndexedDB:', event);
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onupgradeneeded = (event) => {
        console.log('🔧 Creating IndexedDB schema...');
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('models')) {
          const store = db.createObjectStore('models', { keyPath: 'fileName' });
          store.createIndex('repo', 'repo', { unique: false });
          console.log('✅ Created models object store with repo index');
        }
      };

      request.onsuccess = (event) => {
        console.log('✅ IndexedDB opened for storage');
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['models'], 'readwrite');
        const store = transaction.objectStore('models');

        const modelData = {
          fileName,
          blob,
          repo,
          downloadDate: new Date().toISOString(),
          size: blob.size
        };

        console.log('💾 Storing model data:', { fileName, repo, size: blob.size, downloadDate: modelData.downloadDate });
        const addRequest = store.put(modelData);

        addRequest.onsuccess = () => {
          console.log(`✅ Model successfully stored in IndexedDB: ${fileName}`);
          resolve();
        };

        addRequest.onerror = (event) => {
          console.error('❌ Failed to store model in IndexedDB:', event);
          reject(new Error('Failed to store model in IndexedDB'));
        };
      };
    });
  }



  async getStoredModelsFromBrowser(): Promise<LlamaCppModel[]> {
    try {
      console.log('🔍 getStoredModelsFromBrowser() called');
      if (typeof window === 'undefined') {
        console.log('❌ Window not available');
        return [];
      }

      return new Promise((resolve) => {
        console.log('🔍 Opening IndexedDB...');
        const request = indexedDB.open('LlamaCppModels', 1);

        request.onerror = (event) => {
          console.warn('❌ IndexedDB not available:', event);
          resolve([]);
        };

        request.onupgradeneeded = (event) => {
          console.log('🔧 IndexedDB upgrade needed, creating object store...');
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('models')) {
            const store = db.createObjectStore('models', { keyPath: 'fileName' });
            store.createIndex('repo', 'repo', { unique: false });
            console.log('✅ Created models object store');
          }
        };

        request.onsuccess = (event) => {
          console.log('✅ IndexedDB opened successfully');
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('models')) {
            console.log('❌ Models object store does not exist');
            resolve([]);
            return;
          }

          console.log('🔍 Reading models from IndexedDB...');
          const transaction = db.transaction(['models'], 'readonly');
          const store = transaction.objectStore('models');
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const storedModels = getAllRequest.result;
            console.log('📦 Raw stored models:', storedModels);

            const models: LlamaCppModel[] = storedModels.map((stored: any) => ({
              id: stored.fileName.replace('.gguf', ''),
              name: stored.fileName.replace('.gguf', '').replace(/-/g, ' '),
              description: `Browser-stored model from ${stored.repo}`,
              filePath: `browser-storage://${stored.fileName}`,
              size: stored.size,
              parameters: {
                contextSize: 4096,
                threads: 4,
                gpuLayers: 0
              },
              isDownloaded: true,
              isRunning: false
            }));

            console.log(`📦 Converted to ${models.length} LlamaCppModel objects:`, models);
            resolve(models);
          };

          getAllRequest.onerror = (event) => {
            console.warn('❌ Failed to retrieve stored models:', event);
            resolve([]);
          };
        };
      });
    } catch (error) {
      console.error('❌ Failed to get stored models:', error);
      return [];
    }
  }

  // Removed llama-swap methods - using direct server approach

  async startServerWithModel(modelId: string): Promise<void> {
    try {
      console.log(`🚀 [DIRECT] Starting llama.cpp server directly with model: ${modelId}`);

      // Stop any existing server first
      console.log(`🛑 [DIRECT] Stopping any existing direct server...`);
      await this.stopDirectServer();

      // Start llama-server.exe directly with the model
      console.log(`🔄 [DIRECT] Starting new direct server with model: ${modelId}`);
      await this.startDirectServer(modelId);

      console.log(`✅ [DIRECT] Direct llama.cpp server ready with model: ${modelId}`);
    } catch (error) {
      console.error(`❌ [DIRECT] Failed to start direct server with model ${modelId}:`, error);
      throw error;
    }
  }

  async startDirectServer(modelId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log(`🚀 [DIRECT] Calling Electron API to start direct llama-server with model: ${modelId}`);
        const result = await window.electronAPI.llamaCppStartDirect(modelId);
        console.log(`📤 [DIRECT] Electron API result:`, result);
        if (!result.success) {
          throw new Error(result.error || 'Failed to start direct server');
        }
        console.log('✅ [DIRECT] Direct llama-server started successfully via Electron API');
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('❌ [DIRECT] Failed to start direct server:', error);
      throw error;
    }
  }

  async stopDirectServer(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log(`🛑 Stopping direct llama-server...`);
        const result = await window.electronAPI.llamaCppStopDirect();
        if (!result.success) {
          console.warn('Failed to stop direct server:', result.error);
        } else {
          console.log('✅ Direct llama-server stopped successfully');
        }
      }
    } catch (error) {
      console.error('Failed to stop direct server:', error);
    }
  }

  async isDirectServerRunning(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.llamaCppIsDirectRunning();
      }
      return false;
    } catch (error) {
      console.error('Failed to check direct server status:', error);
      return false;
    }
  }

  async testLlamaServer(modelPath: string): Promise<any> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log(`🧪 Testing llama-server.exe with model: ${modelPath}`);
        const result = await window.electronAPI.llamaCppTestServer(modelPath);
        console.log(`🧪 Test result:`, result);
        return result;
      } else {
        return { success: false, error: 'Electron API not available' };
      }
    } catch (error) {
      console.error('Failed to test llama-server:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Removed isLlamaSwapRunning - using direct server approach

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

// Expose debug methods globally for testing
if (typeof window !== 'undefined') {
  (window as any).llamaCppDebug = {
    testIndexedDB: () => llamaCppService.debugIndexedDB(),
    getModels: () => llamaCppService.getModels(),
    getStoredModels: () => llamaCppService.getStoredModelsFromBrowser()
  };
}
