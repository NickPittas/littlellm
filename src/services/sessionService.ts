import { getStorageItem, setStorageItem } from '../utils/storage';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('./debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
export interface SessionStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  currency: string;
  messagesCount: number;
  sessionStartTime: number;
  lastUpdated: number;
}

class SessionService {
  private sessionStats: SessionStats;
  private readonly STORAGE_KEY = 'session-stats';
  private initialized = false;

  constructor() {
    // Initialize with defaults, then load from storage
    this.sessionStats = this.getDefaultStats();
    this.loadSessionStats();
  }

  private getDefaultStats(): SessionStats {
    return {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      currency: 'USD',
      messagesCount: 0,
      sessionStartTime: Date.now(),
      lastUpdated: Date.now()
    };
  }

  private async loadSessionStats(): Promise<void> {
    try {
      const stored = await getStorageItem(this.STORAGE_KEY);
      if (stored) {
        this.sessionStats = JSON.parse(stored);
        this.initialized = true;
      }
    } catch (error) {
      safeDebugLog('warn', 'SESSIONSERVICE', 'Failed to load session stats:', error);
      this.sessionStats = this.getDefaultStats();
    }
    this.initialized = true;
  }

  private async saveSessionStats(): Promise<void> {
    try {
      this.sessionStats.lastUpdated = Date.now();
      await setStorageItem(this.STORAGE_KEY, JSON.stringify(this.sessionStats));
    } catch (error) {
      safeDebugLog('error', 'SESSIONSERVICE', 'Failed to save session stats:', error);
    }
  }

  public async addTokenUsage(
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
    cost?: { totalCost: number; currency: string }
  ): Promise<void> {
    // Ensure all values are valid numbers (not NaN or undefined)
    const safePromptTokens = Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0;
    const safeCompletionTokens = Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0;
    const safeTotalTokens = Number.isFinite(usage.totalTokens) ? usage.totalTokens : (safePromptTokens + safeCompletionTokens);
    const safeTotalCost = cost && Number.isFinite(cost.totalCost) ? cost.totalCost : 0;

    // Ensure session stats are valid numbers
    if (!Number.isFinite(this.sessionStats.totalTokens)) this.sessionStats.totalTokens = 0;
    if (!Number.isFinite(this.sessionStats.promptTokens)) this.sessionStats.promptTokens = 0;
    if (!Number.isFinite(this.sessionStats.completionTokens)) this.sessionStats.completionTokens = 0;
    if (!Number.isFinite(this.sessionStats.totalCost)) this.sessionStats.totalCost = 0;

    this.sessionStats.totalTokens += safeTotalTokens;
    this.sessionStats.promptTokens += safePromptTokens;
    this.sessionStats.completionTokens += safeCompletionTokens;
    this.sessionStats.totalCost += safeTotalCost;
    this.sessionStats.messagesCount += 1;

    // Update currency if provided
    if (cost?.currency) {
      this.sessionStats.currency = cost.currency;
    }

    safeDebugLog('info', 'SESSIONSERVICE', '📊 Session stats updated:', {
      added: {
        promptTokens: safePromptTokens,
        completionTokens: safeCompletionTokens,
        totalTokens: safeTotalTokens,
        totalCost: safeTotalCost,
        currency: cost?.currency || 'N/A'
      },
      newTotals: this.sessionStats
    });

    await this.saveSessionStats();
  }

  public getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  public async resetSession(): Promise<void> {
    this.sessionStats = this.getDefaultStats();
    await this.saveSessionStats();
  }

  public getSessionDuration(): number {
    return Date.now() - this.sessionStats.sessionStartTime;
  }

  public formatSessionDuration(): string {
    const duration = this.getSessionDuration();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  public formatSessionCost(): string {
    const cost = this.sessionStats.totalCost;
    if (cost === 0) {
      return '$0.00';
    }
    if (cost < 0.000001) {
      return '<$0.000001';
    }
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    }
    return `$${cost.toFixed(4)}`;
  }
}

// Create and export a singleton instance
export const sessionService = new SessionService();
