// Model caching and preloading service for Llama.cpp

export interface CachedModel {
  id: string;
  name: string;
  filePath: string;
  size: number;
  lastUsed: number;
  loadTime: number;
  isPreloaded: boolean;
  isActive: boolean;
  priority: 'high' | 'medium' | 'low';
  usage: {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    lastRequest: number;
  };
}

export interface CacheStrategy {
  maxCachedModels: number;
  preloadThreshold: number; // Usage frequency threshold for preloading
  evictionPolicy: 'lru' | 'lfu' | 'hybrid';
  maxCacheSize: number; // in GB
  preloadOnStartup: boolean;
  backgroundPreloading: boolean;
}

export interface ModelSwitchingMetrics {
  switchCount: number;
  averageSwitchTime: number;
  cacheHitRate: number;
  preloadSuccessRate: number;
  totalCacheSize: number;
  evictionCount: number;
}

class LlamaCppModelCache {
  private cachedModels: Map<string, CachedModel> = new Map();
  private strategy: CacheStrategy;
  private metrics: ModelSwitchingMetrics;
  private preloadQueue: Set<string> = new Set();
  private isPreloading = false;

  constructor() {
    this.strategy = {
      maxCachedModels: 3,
      preloadThreshold: 5, // Preload after 5 uses
      evictionPolicy: 'hybrid',
      maxCacheSize: 16, // 16GB max cache
      preloadOnStartup: true,
      backgroundPreloading: true
    };

    this.metrics = {
      switchCount: 0,
      averageSwitchTime: 0,
      cacheHitRate: 0,
      preloadSuccessRate: 0,
      totalCacheSize: 0,
      evictionCount: 0
    };

    this.initializeCache();
  }

  private async initializeCache() {
    console.log('🚀 Initializing Llama.cpp model cache...');
    
    if (this.strategy.preloadOnStartup) {
      await this.preloadFrequentlyUsedModels();
    }
  }

  async switchToModel(modelId: string): Promise<{ success: boolean; switchTime: number; fromCache: boolean }> {
    const startTime = Date.now();
    console.log(`🔄 Switching to model: ${modelId}`);

    try {
      // Check if model is already cached and active
      const cachedModel = this.cachedModels.get(modelId);
      
      if (cachedModel?.isActive) {
        console.log(`✅ Model ${modelId} already active`);
        return { success: true, switchTime: 0, fromCache: true };
      }

      // Deactivate current active model
      await this.deactivateCurrentModel();

      let fromCache = false;
      let switchTime = 0;

      if (cachedModel?.isPreloaded) {
        // Model is preloaded, quick activation
        console.log(`⚡ Activating preloaded model: ${modelId}`);
        await this.activatePreloadedModel(modelId);
        fromCache = true;
        switchTime = Date.now() - startTime;
      } else {
        // Model needs to be loaded
        console.log(`📥 Loading model from disk: ${modelId}`);
        await this.loadAndActivateModel(modelId);
        switchTime = Date.now() - startTime;
      }

      // Update metrics
      this.updateSwitchingMetrics(switchTime, fromCache);

      // Update model usage
      this.updateModelUsage(modelId);

      // Trigger background preloading if enabled
      if (this.strategy.backgroundPreloading) {
        this.scheduleBackgroundPreloading();
      }

      console.log(`✅ Model switch completed in ${switchTime}ms (from cache: ${fromCache})`);
      return { success: true, switchTime, fromCache };

    } catch (error) {
      console.error(`❌ Model switch failed:`, error);
      return { success: false, switchTime: Date.now() - startTime, fromCache: false };
    }
  }

  private async deactivateCurrentModel(): Promise<void> {
    for (const [modelId, model] of this.cachedModels) {
      if (model.isActive) {
        console.log(`🔽 Deactivating model: ${modelId}`);
        model.isActive = false;
        model.lastUsed = Date.now();
        
        // Call llama-swap to unload model if needed
        if (typeof window !== 'undefined' && window.electronAPI) {
          // Could implement model unloading via IPC
        }
        break;
      }
    }
  }

  private async activatePreloadedModel(modelId: string): Promise<void> {
    const model = this.cachedModels.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found in cache`);

    model.isActive = true;
    model.lastUsed = Date.now();

    // Call llama-swap to activate the preloaded model
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Implementation would call llama-swap to switch to preloaded model
      console.log(`🔄 Activating preloaded model via llama-swap: ${modelId}`);
    }
  }

  private async loadAndActivateModel(modelId: string): Promise<void> {
    // Check cache capacity before loading
    await this.ensureCacheCapacity();

    const startTime = Date.now();
    
    // Load model via llama-swap
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Implementation would call llama-swap to load and activate model
      console.log(`📥 Loading and activating model via llama-swap: ${modelId}`);
    }

    const loadTime = Date.now() - startTime;

    // Add to cache
    const cachedModel: CachedModel = {
      id: modelId,
      name: modelId, // Would get actual name from model metadata
      filePath: `/models/${modelId}.gguf`, // Would get actual path
      size: 2.5, // Would get actual size in GB
      lastUsed: Date.now(),
      loadTime,
      isPreloaded: false,
      isActive: true,
      priority: 'medium',
      usage: {
        totalRequests: 1,
        totalTokens: 0,
        averageLatency: 0,
        lastRequest: Date.now()
      }
    };

    this.cachedModels.set(modelId, cachedModel);
    this.updateCacheMetrics();
  }

  private async ensureCacheCapacity(): Promise<void> {
    const currentCacheSize = this.getCurrentCacheSize();
    const modelsToEvict: string[] = [];

    // Check if we need to evict models
    if (this.cachedModels.size >= this.strategy.maxCachedModels || 
        currentCacheSize >= this.strategy.maxCacheSize) {
      
      console.log(`🧹 Cache capacity reached, evicting models...`);
      modelsToEvict.push(...this.selectModelsForEviction());
    }

    // Evict selected models
    for (const modelId of modelsToEvict) {
      await this.evictModel(modelId);
    }
  }

  private selectModelsForEviction(): string[] {
    const models = Array.from(this.cachedModels.values())
      .filter(model => !model.isActive); // Never evict active model

    if (models.length === 0) return [];

    switch (this.strategy.evictionPolicy) {
      case 'lru':
        return this.selectLRUModels(models);
      case 'lfu':
        return this.selectLFUModels(models);
      case 'hybrid':
        return this.selectHybridModels(models);
      default:
        return this.selectLRUModels(models);
    }
  }

  private selectLRUModels(models: CachedModel[]): string[] {
    return models
      .sort((a, b) => a.lastUsed - b.lastUsed)
      .slice(0, 1)
      .map(model => model.id);
  }

  private selectLFUModels(models: CachedModel[]): string[] {
    return models
      .sort((a, b) => a.usage.totalRequests - b.usage.totalRequests)
      .slice(0, 1)
      .map(model => model.id);
  }

  private selectHybridModels(models: CachedModel[]): string[] {
    // Hybrid approach: consider both frequency and recency
    const now = Date.now();
    const scoredModels = models.map(model => ({
      ...model,
      score: (model.usage.totalRequests * 0.6) + 
             ((now - model.lastUsed) / (1000 * 60 * 60) * -0.4) // Recency in hours (negative for older)
    }));

    return scoredModels
      .sort((a, b) => a.score - b.score)
      .slice(0, 1)
      .map(model => model.id);
  }

  private async evictModel(modelId: string): Promise<void> {
    console.log(`🗑️ Evicting model from cache: ${modelId}`);
    
    const model = this.cachedModels.get(modelId);
    if (!model) return;

    // Unload from llama-swap if preloaded
    if (model.isPreloaded && typeof window !== 'undefined' && window.electronAPI) {
      // Implementation would call llama-swap to unload model
      console.log(`📤 Unloading model from llama-swap: ${modelId}`);
    }

    this.cachedModels.delete(modelId);
    this.metrics.evictionCount++;
    this.updateCacheMetrics();
  }

  async preloadModel(modelId: string): Promise<boolean> {
    if (this.cachedModels.get(modelId)?.isPreloaded) {
      console.log(`✅ Model ${modelId} already preloaded`);
      return true;
    }

    try {
      console.log(`⏳ Preloading model: ${modelId}`);
      
      // Ensure cache capacity
      await this.ensureCacheCapacity();

      // Preload via llama-swap
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Implementation would call llama-swap to preload model
        console.log(`📥 Preloading model via llama-swap: ${modelId}`);
      }

      // Update cache entry
      let model = this.cachedModels.get(modelId);
      if (!model) {
        model = {
          id: modelId,
          name: modelId,
          filePath: `/models/${modelId}.gguf`,
          size: 2.5,
          lastUsed: Date.now(),
          loadTime: 0,
          isPreloaded: true,
          isActive: false,
          priority: 'medium',
          usage: {
            totalRequests: 0,
            totalTokens: 0,
            averageLatency: 0,
            lastRequest: 0
          }
        };
        this.cachedModels.set(modelId, model);
      } else {
        model.isPreloaded = true;
      }

      this.updateCacheMetrics();
      console.log(`✅ Model preloaded successfully: ${modelId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to preload model ${modelId}:`, error);
      return false;
    }
  }

  private async preloadFrequentlyUsedModels(): Promise<void> {
    console.log('🔄 Preloading frequently used models...');
    
    // Get model usage history (would be persisted in real implementation)
    const frequentModels = this.getFrequentlyUsedModels();
    
    for (const modelId of frequentModels.slice(0, 2)) { // Preload top 2
      await this.preloadModel(modelId);
    }
  }

  private getFrequentlyUsedModels(): string[] {
    // In a real implementation, this would load from persistent storage
    // For now, return some default frequently used models
    return ['phi-3-mini', 'qwen2.5-0.5b', 'llama-3.2-3b'];
  }

  private scheduleBackgroundPreloading(): void {
    if (this.isPreloading) return;

    setTimeout(() => {
      this.performBackgroundPreloading();
    }, 5000); // Wait 5 seconds before background preloading
  }

  private async performBackgroundPreloading(): Promise<void> {
    if (this.isPreloading) return;
    
    this.isPreloading = true;
    console.log('🔄 Performing background preloading...');

    try {
      // Identify models that should be preloaded
      const candidatesForPreloading = this.identifyPreloadCandidates();
      
      for (const modelId of candidatesForPreloading) {
        if (this.preloadQueue.has(modelId)) continue;
        
        this.preloadQueue.add(modelId);
        const success = await this.preloadModel(modelId);
        
        if (success) {
          this.metrics.preloadSuccessRate = 
            (this.metrics.preloadSuccessRate * 0.9) + (1 * 0.1); // Exponential moving average
        }
        
        this.preloadQueue.delete(modelId);
      }
    } finally {
      this.isPreloading = false;
    }
  }

  private identifyPreloadCandidates(): string[] {
    const candidates: string[] = [];
    
    for (const [modelId, model] of this.cachedModels) {
      if (!model.isPreloaded && 
          model.usage.totalRequests >= this.strategy.preloadThreshold) {
        candidates.push(modelId);
      }
    }

    return candidates.slice(0, 2); // Limit to 2 candidates
  }

  private updateModelUsage(modelId: string): void {
    const model = this.cachedModels.get(modelId);
    if (!model) return;

    model.usage.totalRequests++;
    model.usage.lastRequest = Date.now();
    model.lastUsed = Date.now();
  }

  private updateSwitchingMetrics(switchTime: number, fromCache: boolean): void {
    this.metrics.switchCount++;
    
    // Update average switch time
    this.metrics.averageSwitchTime = 
      (this.metrics.averageSwitchTime * (this.metrics.switchCount - 1) + switchTime) / 
      this.metrics.switchCount;

    // Update cache hit rate
    if (fromCache) {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.switchCount - 1) + 1) / 
        this.metrics.switchCount;
    } else {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.switchCount - 1)) / 
        this.metrics.switchCount;
    }
  }

  private getCurrentCacheSize(): number {
    return Array.from(this.cachedModels.values())
      .reduce((total, model) => total + model.size, 0);
  }

  private updateCacheMetrics(): void {
    this.metrics.totalCacheSize = this.getCurrentCacheSize();
  }

  // Public API methods
  getCacheStatus(): {
    cachedModels: CachedModel[];
    metrics: ModelSwitchingMetrics;
    strategy: CacheStrategy;
  } {
    return {
      cachedModels: Array.from(this.cachedModels.values()),
      metrics: { ...this.metrics },
      strategy: { ...this.strategy }
    };
  }

  updateStrategy(newStrategy: Partial<CacheStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
    console.log('🔧 Cache strategy updated:', this.strategy);
  }

  async clearCache(): Promise<void> {
    console.log('🧹 Clearing model cache...');
    
    for (const [modelId, model] of this.cachedModels) {
      if (!model.isActive) {
        await this.evictModel(modelId);
      }
    }
  }

  getRecommendedModelsForPreloading(): string[] {
    return this.identifyPreloadCandidates();
  }
}

export const llamaCppModelCache = new LlamaCppModelCache();
