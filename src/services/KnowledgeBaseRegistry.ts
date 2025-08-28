// Knowledge Base Registry Service for managing multiple knowledge bases
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgeBase,
  KnowledgeBaseRegistry as KnowledgeBaseRegistryType,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  DEFAULT_KB_COLORS,
  DEFAULT_KB_ICONS,
  DEFAULT_KB_TEMPLATES
} from '../types/knowledgeBase.js';

// Constants
const REGISTRY_NOT_INITIALIZED_ERROR = 'Registry not initialized';

/**
 * Service for managing the registry of multiple knowledge bases
 */
export class KnowledgeBaseRegistry {
  private static instance: KnowledgeBaseRegistry;
  private registry: KnowledgeBaseRegistryType | null = null;
  private registryPath = '';
  private initialized = false;

  private constructor() {}

  /**
   * Gets the singleton instance of the KnowledgeBaseRegistry
   */
  public static getInstance(): KnowledgeBaseRegistry {
    if (!KnowledgeBaseRegistry.instance) {
      KnowledgeBaseRegistry.instance = new KnowledgeBaseRegistry();
    }
    return KnowledgeBaseRegistry.instance;
  }

  /**
   * Initializes the registry with the specified file path
   */
  public async initialize(registryPath: string): Promise<void> {
    if (this.initialized) return;

    this.registryPath = registryPath;
    await this.loadRegistry();
    this.initialized = true;
    console.log('✅ Knowledge Base Registry initialized');
  }

  /**
   * Loads the registry from file or creates a default one
   */
  private async loadRegistry(): Promise<void> {
    try {
      const registryExists = await this.fileExists(this.registryPath);
      if (registryExists) {
        const registryData = await fs.readFile(this.registryPath, 'utf-8');
        this.registry = JSON.parse(registryData);
        
        // Convert date strings back to Date objects
        if (this.registry) {
          this.registry.lastUpdated = new Date(this.registry.lastUpdated);
          this.registry.knowledgeBases = this.registry.knowledgeBases.map(kb => ({
            ...kb,
            createdAt: new Date(kb.createdAt),
            lastUpdated: new Date(kb.lastUpdated)
          }));
        }
        
        console.log(`📋 Loaded ${this.registry?.knowledgeBases.length || 0} knowledge bases from registry`);
      } else {
        await this.createDefaultRegistry();
        console.log('📋 Created default knowledge base registry');
      }
    } catch (error) {
      console.error('❌ Failed to load knowledge base registry:', error);
      await this.createDefaultRegistry();
    }
  }

  /**
   * Creates a default registry with a general knowledge base
   */
  private async createDefaultRegistry(): Promise<void> {
    const defaultKB = await this.createDefaultKnowledgeBase();
    
    this.registry = {
      knowledgeBases: [defaultKB],
      defaultKnowledgeBaseId: defaultKB.id,
      version: '1.0.0',
      lastUpdated: new Date()
    };

    await this.saveRegistry();
  }

  /**
   * Creates the default "General" knowledge base
   */
  private async createDefaultKnowledgeBase(): Promise<KnowledgeBase> {
    const id = uuidv4();
    const now = new Date();
    
    return {
      id,
      name: 'General Knowledge',
      description: 'Default knowledge base for general documents and information',
      color: DEFAULT_KB_COLORS[0], // Blue
      icon: DEFAULT_KB_ICONS[0], // 📚
      tableName: this.generateTableName('General Knowledge', id),
      documentCount: 0,
      lastUpdated: now,
      createdAt: now,
      tags: ['general', 'default'],
      metadata: {},
      isDefault: true
    };
  }

  /**
   * Saves the registry to file
   */
  private async saveRegistry(): Promise<void> {
    if (!this.registry) return;

    try {
      // Ensure the directory exists
      const registryDir = path.dirname(this.registryPath);
      await fs.mkdir(registryDir, { recursive: true });

      const registryData = JSON.stringify(this.registry, null, 2);
      await fs.writeFile(this.registryPath, registryData, 'utf-8');
      console.log('✅ Knowledge base registry saved');
    } catch (error) {
      console.error('❌ Failed to save knowledge base registry:', error);
      throw error;
    }
  }

  /**
   * Creates a new knowledge base
   */
  public async createKnowledgeBase(request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);

    // Validate name uniqueness
    const existingKB = this.registry.knowledgeBases.find(kb => 
      kb.name.toLowerCase() === request.name.toLowerCase()
    );
    if (existingKB) {
      throw new Error(`Knowledge base with name "${request.name}" already exists`);
    }

    const id = uuidv4();
    const now = new Date();
    
    // Assign random color and icon if not provided
    const color = request.color || this.getRandomColor();
    const icon = request.icon || this.getRandomIcon();

    const knowledgeBase: KnowledgeBase = {
      id,
      name: request.name,
      description: request.description,
      color,
      icon,
      tableName: this.generateTableName(request.name, id),
      documentCount: 0,
      lastUpdated: now,
      createdAt: now,
      tags: request.tags || [],
      metadata: request.metadata || {},
      isDefault: request.isDefault || false
    };

    // If this is set as default, update the default ID
    if (request.isDefault) {
      this.registry.defaultKnowledgeBaseId = id;
      // Remove default flag from other KBs
      this.registry.knowledgeBases.forEach(kb => kb.isDefault = false);
    }

    this.registry.knowledgeBases.push(knowledgeBase);
    this.registry.lastUpdated = now;
    
    await this.saveRegistry();
    
    console.log(`✅ Created knowledge base: ${knowledgeBase.name} (${id})`);
    return knowledgeBase;
  }

  /**
   * Updates an existing knowledge base
   */
  public async updateKnowledgeBase(id: string, updates: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);

    const kbIndex = this.registry.knowledgeBases.findIndex(kb => kb.id === id);
    if (kbIndex === -1) {
      throw new Error(`Knowledge base with ID "${id}" not found`);
    }

    const knowledgeBase = this.registry.knowledgeBases[kbIndex];

    // Validate name uniqueness if name is being changed
    if (updates.name && updates.name !== knowledgeBase.name) {
      const existingKB = this.registry.knowledgeBases.find(kb => 
        kb.name.toLowerCase() === updates.name!.toLowerCase() && kb.id !== id
      );
      if (existingKB) {
        throw new Error(`Knowledge base with name "${updates.name}" already exists`);
      }
    }

    // Apply updates
    const updatedKB: KnowledgeBase = {
      ...knowledgeBase,
      ...updates,
      id, // Ensure ID cannot be changed
      lastUpdated: new Date()
    };

    this.registry.knowledgeBases[kbIndex] = updatedKB;
    this.registry.lastUpdated = new Date();
    
    await this.saveRegistry();
    
    console.log(`✅ Updated knowledge base: ${updatedKB.name} (${id})`);
    return updatedKB;
  }

  /**
   * Deletes a knowledge base
   */
  public async deleteKnowledgeBase(id: string): Promise<void> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);

    const kbIndex = this.registry.knowledgeBases.findIndex(kb => kb.id === id);
    if (kbIndex === -1) {
      throw new Error(`Knowledge base with ID "${id}" not found`);
    }

    const knowledgeBase = this.registry.knowledgeBases[kbIndex];

    // Prevent deletion of default KB if it's the only one
    if (knowledgeBase.isDefault && this.registry.knowledgeBases.length === 1) {
      throw new Error('Cannot delete the only knowledge base');
    }

    // Remove from registry
    this.registry.knowledgeBases.splice(kbIndex, 1);

    // If this was the default, set a new default
    if (knowledgeBase.isDefault && this.registry.knowledgeBases.length > 0) {
      this.registry.knowledgeBases[0].isDefault = true;
      this.registry.defaultKnowledgeBaseId = this.registry.knowledgeBases[0].id;
    }

    this.registry.lastUpdated = new Date();
    await this.saveRegistry();
    
    console.log(`✅ Deleted knowledge base: ${knowledgeBase.name} (${id})`);
  }

  /**
   * Gets a knowledge base by ID
   */
  public async getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);
    
    return this.registry.knowledgeBases.find(kb => kb.id === id) || null;
  }

  /**
   * Gets all knowledge bases
   */
  public async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);
    
    return [...this.registry.knowledgeBases];
  }

  /**
   * Gets the default knowledge base
   */
  public async getDefaultKnowledgeBase(): Promise<KnowledgeBase | null> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);
    
    return this.registry.knowledgeBases.find(kb => 
      kb.id === this.registry!.defaultKnowledgeBaseId
    ) || null;
  }

  /**
   * Sets a knowledge base as default
   */
  public async setDefaultKnowledgeBase(id: string): Promise<void> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);

    const knowledgeBase = await this.getKnowledgeBase(id);
    if (!knowledgeBase) {
      throw new Error(`Knowledge base with ID "${id}" not found`);
    }

    // Remove default flag from all KBs
    this.registry.knowledgeBases.forEach(kb => kb.isDefault = false);
    
    // Set the new default
    knowledgeBase.isDefault = true;
    this.registry.defaultKnowledgeBaseId = id;
    this.registry.lastUpdated = new Date();
    
    await this.saveRegistry();
    
    console.log(`✅ Set default knowledge base: ${knowledgeBase.name} (${id})`);
  }

  /**
   * Updates document count for a knowledge base
   */
  public async updateDocumentCount(id: string, count: number): Promise<void> {
    const knowledgeBase = await this.getKnowledgeBase(id);
    if (!knowledgeBase) {
      throw new Error(`Knowledge base with ID "${id}" not found`);
    }

    knowledgeBase.documentCount = count;
    knowledgeBase.lastUpdated = new Date();
    
    if (this.registry) {
      this.registry.lastUpdated = new Date();
      await this.saveRegistry();
    }
  }

  /**
   * Gets knowledge bases that match a template
   */
  public async getKnowledgeBasesByTemplate(templateId: string): Promise<KnowledgeBase[]> {
    if (!this.registry) throw new Error(REGISTRY_NOT_INITIALIZED_ERROR);
    
    const template = DEFAULT_KB_TEMPLATES.find(t => t.id === templateId);
    if (!template) return [];

    return this.registry.knowledgeBases.filter(kb => 
      kb.tags.some(tag => template.tags.includes(tag)) ||
      kb.name.toLowerCase().includes(template.name.toLowerCase())
    );
  }

  /**
   * Creates knowledge bases from templates
   */
  public async createFromTemplate(templateId: string): Promise<KnowledgeBase> {
    const template = DEFAULT_KB_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template with ID "${templateId}" not found`);
    }

    const request: CreateKnowledgeBaseRequest = {
      name: template.name,
      description: template.description,
      color: template.color,
      icon: template.icon,
      tags: [...template.tags],
      metadata: { templateId, category: template.category }
    };

    return await this.createKnowledgeBase(request);
  }

  /**
   * Generates a unique table name for LanceDB
   */
  private generateTableName(name: string, id: string): string {
    // Sanitize name for table naming
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // Take first 8 characters of ID for uniqueness
    const shortId = id.substring(0, 8);
    
    return `kb_${sanitizedName}_${shortId}`;
  }

  /**
   * Gets a random color from the default palette
   */
  private getRandomColor(): string {
    return DEFAULT_KB_COLORS[Math.floor(Math.random() * DEFAULT_KB_COLORS.length)];
  }

  /**
   * Gets a random icon from the default set
   */
  private getRandomIcon(): string {
    return DEFAULT_KB_ICONS[Math.floor(Math.random() * DEFAULT_KB_ICONS.length)];
  }

  /**
   * Checks if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the current registry (for debugging/testing)
   */
  public getRegistry(): KnowledgeBaseRegistryType | null {
    return this.registry;
  }

  /**
   * Validates the registry integrity
   */
  public async validateRegistry(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.registry) {
      errors.push(REGISTRY_NOT_INITIALIZED_ERROR);
      return { isValid: false, errors };
    }

    // Check for duplicate names
    const names = this.registry.knowledgeBases.map(kb => kb.name.toLowerCase());
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push(`Duplicate knowledge base names: ${duplicateNames.join(', ')}`);
    }

    // Check for duplicate table names
    const tableNames = this.registry.knowledgeBases.map(kb => kb.tableName);
    const duplicateTableNames = tableNames.filter((name, index) => tableNames.indexOf(name) !== index);
    if (duplicateTableNames.length > 0) {
      errors.push(`Duplicate table names: ${duplicateTableNames.join(', ')}`);
    }

    // Check for valid default KB
    const defaultKB = this.registry.knowledgeBases.find(kb => kb.id === this.registry!.defaultKnowledgeBaseId);
    if (!defaultKB) {
      errors.push('Default knowledge base not found in registry');
    }

    return { isValid: errors.length === 0, errors };
  }
}

// Export singleton instance
export const knowledgeBaseRegistry = KnowledgeBaseRegistry.getInstance();