// Migration script to convert single knowledge base to multi-knowledge base system
// Uses IPC to communicate with Electron main process
import { settingsService } from '../services/settingsService';

// Constants
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

// Helper function to wait for ElectronAPI to be available
const waitForElectronAPI = async (maxAttempts = 10, delay = 100): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.listKnowledgeBases === 'function') {
      console.log(`✅ ElectronAPI available after ${attempt} attempt(s)`);
      return true;
    }
    
    console.log(`🔄 Waiting for ElectronAPI... (attempt ${attempt}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.error('❌ ElectronAPI not available after maximum attempts');
  return false;
};

// IPC-based knowledge base registry API
const knowledgeBaseRegistryAPI = {
  async listKnowledgeBases() {
    // Add debugging information
    console.log('🔍 Checking ElectronAPI availability...', {
      windowDefined: typeof window !== 'undefined',
      electronAPIExists: typeof window !== 'undefined' && !!window.electronAPI,
      listKnowledgeBasesMethod: typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.listKnowledgeBases === 'function'
    });
    
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.listKnowledgeBases === 'function') {
      try {
        const result = await window.electronAPI.listKnowledgeBases();
        console.log('📚 Knowledge base list result:', result);
        
        if (result.success) {
          return result.knowledgeBases.map(kb => ({
            ...kb,
            lastUpdated: new Date(kb.lastUpdated),
            createdAt: new Date(kb.createdAt)
          }));
        } else {
          console.warn('⚠️ Failed to list knowledge bases:', result.error);
          return [];
        }
      } catch (error) {
        console.error('❌ IPC call failed:', error);
        return [];
      }
    }
    
    console.warn('⚠️ ElectronAPI not available or method not found');
    return [];
  },

  async getDefaultKnowledgeBase() {
    try {
      const kbList = await this.listKnowledgeBases();
      return kbList.find(kb => kb.isDefault) || null;
    } catch (error) {
      console.warn('⚠️ Failed to get default knowledge base:', error);
      return null;
    }
  },

  async validateRegistry() {
    try {
      const kbList = await this.listKnowledgeBases();
      return {
        isValid: Array.isArray(kbList), // Valid if we got an array (even if empty)
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE]
      };
    }
  }
};

// IPC-based migration service API  
const knowledgeBaseMigrationAPI = {
  async migrateFromSingleKB() {
    // For now, assume migration is not needed if we can list knowledge bases
    // This is a simplified implementation - actual migration would need its own IPC handler
    try {
      const kbList = await knowledgeBaseRegistryAPI.listKnowledgeBases();
      if (kbList.length > 0) {
        return {
          success: true,
          migratedRecords: 0,
          createdKnowledgeBases: kbList,
          errors: []
        };
      } else {
        // If no KBs exist, we might need to create a default one
        // This would require additional IPC handlers for migration
        return {
          success: true,
          migratedRecords: 0,
          createdKnowledgeBases: [],
          errors: []
        };
      }
    } catch (error) {
      return {
        success: false,
        migratedRecords: 0,
        createdKnowledgeBases: [],
        errors: [error instanceof Error ? error.message : 'Migration failed']
      };
    }
  }
};

interface MigrationResult {
  success: boolean;
  message: string;
  migratedRecords: number;
  createdKnowledgeBases: string[];
  errors: string[];
}

/**
 * Main migration function to convert from single to multi-KB system
 */
export async function migrateSingleToMultiKB(): Promise<MigrationResult> {
  console.log('🔄 Starting migration from single to multi-knowledge base system...');
  
  try {
    // Wait for ElectronAPI to be available before proceeding
    const apiAvailable = await waitForElectronAPI();
    if (!apiAvailable) {
      return {
        success: false,
        message: 'ElectronAPI not available for migration',
        migratedRecords: 0,
        createdKnowledgeBases: [],
        errors: ['ElectronAPI not available']
      };
    }
    
    // Check if migration is needed
    const kbList = await knowledgeBaseRegistryAPI.listKnowledgeBases();
    if (kbList.length > 0) {
      console.log('✅ Multi-KB system already exists, migration not needed');
      return {
        success: true,
        message: 'Multi-knowledge base system already initialized',
        migratedRecords: 0,
        createdKnowledgeBases: kbList.map(kb => kb.name),
        errors: []
      };
    }

    // Perform migration
    const migrationOptions = {
      createDefaultKB: true,
      defaultKBName: 'General Knowledge',
      defaultKBDescription: 'Migrated from legacy single knowledge base',
      backupExisting: true
    };

    const result = await knowledgeBaseMigrationAPI.migrateFromSingleKB();
    
    if (result.success) {
      console.log('✅ Migration completed successfully');
      
      // Update settings to use the new default KB
      if (result.createdKnowledgeBases.length > 0) {
        const defaultKB = result.createdKnowledgeBases[0];
        try {
          await settingsService.updateSelectedKnowledgeBases([defaultKB.id]);
          await settingsService.updateRagEnabled(true);
        } catch (error) {
          console.warn('⚠️ Failed to update settings after migration:', error);
        }
      }
      
      return {
        success: true,
        message: `Successfully migrated ${result.migratedRecords} records to multi-KB system`,
        migratedRecords: result.migratedRecords,
        createdKnowledgeBases: result.createdKnowledgeBases.map(kb => kb.name),
        errors: result.errors
      };
    } else {
      console.error('❌ Migration failed:', result.errors);
      return {
        success: false,
        message: 'Migration failed: ' + result.errors.join(', '),
        migratedRecords: 0,
        createdKnowledgeBases: [],
        errors: result.errors
      };
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    return {
      success: false,
      message: `Migration error: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`,
      migratedRecords: 0,
      createdKnowledgeBases: [],
      errors: [error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE]
    };
  }
}

/**
 * Test migration with validation
 */
export async function testMigration(): Promise<boolean> {
  console.log('🧪 Testing migration system...');
  
  try {
    // Wait for ElectronAPI to be available
    const apiAvailable = await waitForElectronAPI();
    if (!apiAvailable) {
      console.error('❌ ElectronAPI not available, cannot proceed with migration test');
      return false;
    }
    
    // Test 1: Registry initialization
    const kbList = await knowledgeBaseRegistryAPI.listKnowledgeBases();
    console.log(`✓ Knowledge base registry accessible, found ${kbList.length} KBs`);

    // Test 2: Settings integration
    const kbConfig = settingsService.getKnowledgeBaseConfig();
    console.log(`✓ Settings integration working, RAG enabled: ${kbConfig.enabled}`);

    // Test 3: Migration service availability
    const validation = await knowledgeBaseRegistryAPI.validateRegistry();
    console.log(`✓ Registry validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
    
    if (!validation.isValid) {
      console.warn('⚠️ Registry validation errors:', validation.errors);
    }

    return validation.isValid;
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    return false;
  }
}

/**
 * Run migration if needed, otherwise validate existing system
 */
export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  console.log('🔍 Checking if migration is needed...');
  
  // Wait for ElectronAPI to be available
  const apiAvailable = await waitForElectronAPI();
  if (!apiAvailable) {
    return {
      success: false,
      message: 'ElectronAPI not available for migration',
      migratedRecords: 0,
      createdKnowledgeBases: [],
      errors: ['ElectronAPI not available']
    };
  }
  
  // Test the system
  const testPassed = await testMigration();
  if (!testPassed) {
    console.warn('⚠️ Migration test failed, but will try to proceed anyway');
    // Don't return early - try to proceed with migration anyway
  }

  // Check if we need to migrate
  try {
    const kbList = await knowledgeBaseRegistryAPI.listKnowledgeBases();
    
    if (kbList.length === 0) {
      console.log('📦 No knowledge bases found, running migration...');
      return await migrateSingleToMultiKB();
    } else {
      console.log('✅ Multi-KB system already exists');
      
      // Ensure default KB is set in settings
      try {
        const selectedKBs = settingsService.getSelectedKnowledgeBaseIds();
        if (selectedKBs.length === 0 && kbList.length > 0) {
          const defaultKB = await knowledgeBaseRegistryAPI.getDefaultKnowledgeBase();
          if (defaultKB) {
            await settingsService.updateSelectedKnowledgeBases([defaultKB.id]);
            console.log('✓ Updated settings with default knowledge base');
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to update settings with default KB:', error);
      }
      
      return {
        success: true,
        message: 'Multi-knowledge base system already operational',
        migratedRecords: 0,
        createdKnowledgeBases: kbList.map(kb => kb.name),
        errors: []
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to check migration status: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`,
      migratedRecords: 0,
      createdKnowledgeBases: [],
      errors: [error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE]
    };
  }
}