/**
 * Basic Memory System Test (JavaScript)
 * Simple test without Jest dependencies to verify core functionality
 */

// Mock Electron API for testing
const mockElectronAPI = {
  loadMemoryIndex: () => Promise.resolve(null),
  saveMemoryIndex: () => Promise.resolve(true),
  loadMemoryEntry: () => Promise.resolve(null),
  saveMemoryEntry: () => Promise.resolve(true),
  deleteMemoryEntry: () => Promise.resolve(true),
  getMemoryStats: () => Promise.resolve({ totalSize: 0, entryCount: 0 })
};

// Setup mock for window.electronAPI
global.window = {
  electronAPI: mockElectronAPI
};

// Import the memory tools
import { executeMemoryTool } from '../services/memoryMCPTools.js';

async function testMemorySystem() {
  console.log('🧠 Starting Memory System Basic Test...');

  try {
    // Test 1: Store a memory
    console.log('\n📝 Test 1: Store Memory');
    const storeResult = await executeMemoryTool('memory-store', {
      type: 'user_preference',
      title: 'Test Preference',
      content: 'User prefers dark theme for better readability',
      tags: ['ui', 'theme', 'preference']
    });

    console.log('Store result:', storeResult);
    
    if (storeResult.success) {
      console.log('✅ Memory store test passed');
    } else {
      console.log('❌ Memory store test failed:', storeResult.error);
      return false;
    }

    // Test 2: Search memories
    console.log('\n🔍 Test 2: Search Memories');
    const searchResult = await executeMemoryTool('memory-search', {
      text: 'theme',
      limit: 5
    });

    console.log('Search result:', searchResult);
    
    if (searchResult.success) {
      console.log('✅ Memory search test passed');
    } else {
      console.log('❌ Memory search test failed:', searchResult.error);
      return false;
    }

    // Test 3: Test unknown tool
    console.log('\n❓ Test 3: Unknown Tool');
    const unknownResult = await executeMemoryTool('unknown-tool', {});

    console.log('Unknown tool result:', unknownResult);
    
    if (!unknownResult.success && unknownResult.error.includes('Unknown memory tool')) {
      console.log('✅ Unknown tool test passed');
    } else {
      console.log('❌ Unknown tool test failed');
      return false;
    }

    console.log('\n🎉 All basic memory system tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Memory system test failed with error:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testMemorySystem().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testMemorySystem };
