/**
 * Initialization Manager
 * 
 * Centralized service to manage initialization state and prevent duplicate initialization
 * across all services in the application.
 */

export interface InitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  initializationPromise: Promise<void> | null;
  error: Error | null;
  timestamp: number;
}

class InitializationManager {
  private static instance: InitializationManager;
  private services: Map<string, InitializationState> = new Map();
  private globalInitialized = false;

  private constructor() {}

  public static getInstance(): InitializationManager {
    if (!InitializationManager.instance) {
      InitializationManager.instance = new InitializationManager();
    }
    return InitializationManager.instance;
  }

  /**
   * Register a service for initialization tracking
   */
  registerService(serviceName: string): void {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        isInitialized: false,
        isInitializing: false,
        initializationPromise: null,
        error: null,
        timestamp: 0
      });
    }
  }

  /**
   * Check if a service is initialized
   */
  isServiceInitialized(serviceName: string): boolean {
    const state = this.services.get(serviceName);
    return state?.isInitialized || false;
  }

  /**
   * Check if a service is currently initializing
   */
  isServiceInitializing(serviceName: string): boolean {
    const state = this.services.get(serviceName);
    return state?.isInitializing || false;
  }

  /**
   * Start initialization for a service
   */
  async startInitialization<T>(
    serviceName: string, 
    initFunction: () => Promise<T>
  ): Promise<T> {
    this.registerService(serviceName);
    const state = this.services.get(serviceName)!;

    // If already initialized, return immediately
    if (state.isInitialized) {
      return Promise.resolve() as Promise<T>;
    }

    // If currently initializing, wait for existing initialization
    if (state.isInitializing && state.initializationPromise) {
      await state.initializationPromise;
      return Promise.resolve() as Promise<T>;
    }

    // Start new initialization
    state.isInitializing = true;
    state.error = null;
    state.timestamp = Date.now();

    const initPromise = (async () => {
      try {
        const result = await initFunction();
        state.isInitialized = true;
        state.isInitializing = false;
        state.initializationPromise = null;
        console.log(`✅ ${serviceName} initialized successfully`);
        return result;
      } catch (error) {
        state.isInitialized = false;
        state.isInitializing = false;
        state.initializationPromise = null;
        state.error = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ ${serviceName} initialization failed:`, error);
        throw error;
      }
    })();

    state.initializationPromise = initPromise.then(() => {});
    return initPromise;
  }

  /**
   * Wait for a service to be initialized
   */
  async waitForService(serviceName: string, timeoutMs = 10000): Promise<void> {
    const state = this.services.get(serviceName);
    
    if (!state) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    if (state.isInitialized) {
      return;
    }

    if (state.initializationPromise) {
      // Wait for existing initialization with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout waiting for ${serviceName} initialization`)), timeoutMs);
      });

      await Promise.race([state.initializationPromise, timeoutPromise]);
      return;
    }

    throw new Error(`Service ${serviceName} is not initializing`);
  }

  /**
   * Reset a service's initialization state (for testing or error recovery)
   */
  resetService(serviceName: string): void {
    const state = this.services.get(serviceName);
    if (state) {
      state.isInitialized = false;
      state.isInitializing = false;
      state.initializationPromise = null;
      state.error = null;
      state.timestamp = 0;
    }
  }

  /**
   * Get initialization state for a service
   */
  getServiceState(serviceName: string): InitializationState | null {
    return this.services.get(serviceName) || null;
  }

  /**
   * Get all service states (for debugging)
   */
  getAllServiceStates(): Record<string, InitializationState> {
    const states: Record<string, InitializationState> = {};
    for (const [name, state] of this.services.entries()) {
      states[name] = { ...state };
    }
    return states;
  }

  /**
   * Mark global initialization as complete
   */
  setGlobalInitialized(): void {
    this.globalInitialized = true;
    console.log('🎯 Global application initialization complete');
  }

  /**
   * Check if global initialization is complete
   */
  isGlobalInitialized(): boolean {
    return this.globalInitialized;
  }

  /**
   * Wait for all registered services to be initialized
   */
  async waitForAllServices(timeoutMs = 30000): Promise<void> {
    const serviceNames = Array.from(this.services.keys());
    const promises = serviceNames.map(name => this.waitForService(name, timeoutMs));
    
    try {
      await Promise.all(promises);
      this.setGlobalInitialized();
    } catch (error) {
      console.error('❌ Not all services initialized successfully:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const initializationManager = InitializationManager.getInstance();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).initializationManager = initializationManager;
}
