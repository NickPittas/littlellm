/**
 * Service Registry
 * 
 * Centralized registry to manage service dependencies and break circular dependencies.
 * Services register themselves and can access other services through the registry.
 */

export interface ServiceInterface {
  name: string;
  isInitialized(): boolean;
}

export interface DebugLoggerInterface {
  debug(...args: unknown[]): void;
  info(prefix: string, ...args: unknown[]): void;
  warn(prefix: string, ...args: unknown[]): void;
  error(prefix: string, ...args: unknown[]): void;
  success(prefix: string, ...args: unknown[]): void;
  refreshFromSettings(): void;
  isEnabled(): boolean;
}

export interface SettingsServiceInterface {
  getSettings(): any;
  isInitialized(): boolean;
  addListener(callback: (settings: any) => void): void;
  removeListener(callback: (settings: any) => void): void;
}

class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, any> = new Map();
  private callbacks: Map<string, Array<(service: any) => void>> = new Map();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service in the registry
   */
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
    
    // Notify any waiting callbacks
    const callbacks = this.callbacks.get(name) || [];
    callbacks.forEach(callback => callback(service));
    this.callbacks.delete(name);
  }

  /**
   * Get a service from the registry
   */
  getService<T>(name: string): T | null {
    return this.services.get(name) || null;
  }

  /**
   * Get a service with a callback when it becomes available
   */
  getServiceAsync<T>(name: string, callback: (service: T) => void): void {
    const service = this.services.get(name);
    if (service) {
      callback(service);
      return;
    }

    // Service not available yet, register callback
    if (!this.callbacks.has(name)) {
      this.callbacks.set(name, []);
    }
    this.callbacks.get(name)!.push(callback);
  }

  /**
   * Check if a service is registered
   */
  hasService(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Unregister a service (for testing)
   */
  unregisterService(name: string): void {
    this.services.delete(name);
    this.callbacks.delete(name);
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.callbacks.clear();
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();

// Service name constants to avoid typos
export const SERVICE_NAMES = {
  DEBUG_LOGGER: 'debugLogger',
  SETTINGS_SERVICE: 'settingsService',
  SECURE_API_KEY_SERVICE: 'secureApiKeyService',
  INTERNAL_COMMAND_SERVICE: 'internalCommandService',
  INITIALIZATION_MANAGER: 'initializationManager'
} as const;

// Helper functions for common services
export function getDebugLogger(): DebugLoggerInterface | null {
  return serviceRegistry.getService<DebugLoggerInterface>(SERVICE_NAMES.DEBUG_LOGGER);
}

export function getSettingsService(): SettingsServiceInterface | null {
  return serviceRegistry.getService<SettingsServiceInterface>(SERVICE_NAMES.SETTINGS_SERVICE);
}

export function onDebugLoggerReady(callback: (logger: DebugLoggerInterface) => void): void {
  serviceRegistry.getServiceAsync<DebugLoggerInterface>(SERVICE_NAMES.DEBUG_LOGGER, callback);
}

export function onSettingsServiceReady(callback: (settings: SettingsServiceInterface) => void): void {
  serviceRegistry.getServiceAsync<SettingsServiceInterface>(SERVICE_NAMES.SETTINGS_SERVICE, callback);
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).serviceRegistry = serviceRegistry;
}
