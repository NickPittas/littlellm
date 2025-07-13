import { getStorageItem, setStorageItem } from '../utils/storage';

export interface SessionStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
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
      console.warn('Failed to load session stats:', error);
      this.sessionStats = this.getDefaultStats();
    }
    this.initialized = true;
  }

  private async saveSessionStats(): Promise<void> {
    try {
      this.sessionStats.lastUpdated = Date.now();
      await setStorageItem(this.STORAGE_KEY, JSON.stringify(this.sessionStats));
    } catch (error) {
      console.error('Failed to save session stats:', error);
    }
  }

  public async addTokenUsage(usage: { promptTokens: number; completionTokens: number; totalTokens: number }): Promise<void> {
    // Ensure all values are valid numbers (not NaN or undefined)
    const safePromptTokens = Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0;
    const safeCompletionTokens = Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0;
    const safeTotalTokens = Number.isFinite(usage.totalTokens) ? usage.totalTokens : (safePromptTokens + safeCompletionTokens);

    // Ensure session stats are valid numbers
    if (!Number.isFinite(this.sessionStats.totalTokens)) this.sessionStats.totalTokens = 0;
    if (!Number.isFinite(this.sessionStats.promptTokens)) this.sessionStats.promptTokens = 0;
    if (!Number.isFinite(this.sessionStats.completionTokens)) this.sessionStats.completionTokens = 0;

    this.sessionStats.totalTokens += safeTotalTokens;
    this.sessionStats.promptTokens += safePromptTokens;
    this.sessionStats.completionTokens += safeCompletionTokens;
    this.sessionStats.messagesCount += 1;

    console.log('📊 Session stats updated:', {
      added: { promptTokens: safePromptTokens, completionTokens: safeCompletionTokens, totalTokens: safeTotalTokens },
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
}

// Create and export a singleton instance
export const sessionService = new SessionService();
