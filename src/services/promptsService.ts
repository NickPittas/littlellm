import promptsData from '../data/prompts.json';
import { getStorageItem, setStorageItem } from '../utils/storage';

export interface Prompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
}

export interface PromptsData {
  prompts: Prompt[];
}

class PromptsService {
  private prompts: Prompt[] = [];
  private customPrompts: Prompt[] = [];
  private initialized = false;

  constructor() {
    this.loadDefaultPrompts();
    // Only load custom prompts on client side
    if (typeof window !== 'undefined') {
      this.loadCustomPrompts();
      this.initialized = true;
    }
  }

  private ensureInitialized() {
    if (!this.initialized && typeof window !== 'undefined') {
      // Load custom prompts asynchronously but don't block
      this.loadCustomPrompts().catch(error => {
        console.error('Failed to load custom prompts:', error);
      });
      this.initialized = true;
    }
  }

  private loadDefaultPrompts() {
    this.prompts = (promptsData as PromptsData).prompts;
  }

  private async loadCustomPrompts() {
    try {
      const stored = await getStorageItem('custom-prompts');
      if (stored) {
        this.customPrompts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load custom prompts:', error);
      this.customPrompts = [];
    }
  }

  private async saveCustomPrompts() {
    try {
      await setStorageItem('custom-prompts', JSON.stringify(this.customPrompts));
    } catch (error) {
      console.error('Failed to save custom prompts:', error);
    }
  }

  getAllPrompts(): Prompt[] {
    this.ensureInitialized();
    return [...this.prompts, ...this.customPrompts];
  }

  getCustomPrompts(): Prompt[] {
    this.ensureInitialized();
    return [...this.customPrompts];
  }

  getPromptsByCategory(category: string): Prompt[] {
    const allPrompts = this.getAllPrompts();
    return allPrompts.filter(prompt => prompt.category === category);
  }

  getPromptById(id: string): Prompt | undefined {
    const allPrompts = this.getAllPrompts();
    return allPrompts.find(prompt => prompt.id === id);
  }

  getCategories(): string[] {
    const allPrompts = this.getAllPrompts();
    const categories = new Set(allPrompts.map(prompt => prompt.category));
    return Array.from(categories).sort();
  }

  processPrompt(promptId: string, content: string): string {
    const prompt = this.getPromptById(promptId);
    if (!prompt) {
      throw new Error(`Prompt with id "${promptId}" not found`);
    }

    return prompt.prompt.replace('{content}', content);
  }

  async addCustomPrompt(prompt: Omit<Prompt, 'id'>): Promise<Prompt> {
    const newPrompt: Prompt = {
      ...prompt,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.customPrompts.push(newPrompt);
    await this.saveCustomPrompts();
    return newPrompt;
  }

  async updateCustomPrompt(id: string, updates: Partial<Omit<Prompt, 'id'>>): Promise<boolean> {
    const index = this.customPrompts.findIndex(prompt => prompt.id === id);
    if (index === -1) {
      return false;
    }

    this.customPrompts[index] = { ...this.customPrompts[index], ...updates };
    await this.saveCustomPrompts();
    return true;
  }

  async deleteCustomPrompt(id: string): Promise<boolean> {
    const index = this.customPrompts.findIndex(prompt => prompt.id === id);
    if (index === -1) {
      return false;
    }

    this.customPrompts.splice(index, 1);
    await this.saveCustomPrompts();
    return true;
  }

  isCustomPrompt(id: string): boolean {
    return this.customPrompts.some(prompt => prompt.id === id);
  }

  /**
   * Find existing custom copy of a built-in prompt
   * This helps prevent duplicate custom prompts when editing built-in ones
   */
  findCustomCopyOfBuiltinPrompt(builtinPrompt: Prompt): Prompt | undefined {
    if (this.isCustomPrompt(builtinPrompt.id)) {
      return undefined; // Already a custom prompt
    }

    // Look for custom prompts that might be copies of this built-in prompt
    // We'll match based on the original name (removing " (Custom)" suffix if present)
    const originalName = builtinPrompt.name;
    const customCopyName = `${originalName} (Custom)`;

    return this.customPrompts.find(customPrompt =>
      customPrompt.name === customCopyName ||
      customPrompt.name === originalName ||
      // Also check if the prompt content is very similar (in case user renamed it)
      (customPrompt.prompt === builtinPrompt.prompt && customPrompt.category === builtinPrompt.category)
    );
  }

  exportPrompts(): string {
    return JSON.stringify({
      prompts: this.customPrompts
    }, null, 2);
  }

  async importPrompts(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);
      if (data.prompts && Array.isArray(data.prompts)) {
        // Validate prompt structure
        const validPrompts = data.prompts.filter((prompt: unknown) => {
          const p = prompt as Record<string, unknown>;
          return p.name && p.description && p.prompt && p.category;
        });

        // Add unique IDs if missing
        validPrompts.forEach((prompt: unknown) => {
          const p = prompt as Record<string, unknown>;
          if (!p.id) {
            p.id = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          if (!p.icon) {
            p.icon = '📝';
          }
        });

        this.customPrompts.push(...validPrompts);
        await this.saveCustomPrompts();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import prompts:', error);
      return false;
    }
  }
}

export const promptsService = new PromptsService();
