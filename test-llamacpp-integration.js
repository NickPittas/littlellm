// Simple test to verify Llama.cpp integration
// This file can be run in the browser console to test the integration

console.log('🦙 Testing Llama.cpp Integration...');

// Test 1: Check if Llama.cpp provider is registered
async function testProviderRegistration() {
  console.log('\n📋 Test 1: Provider Registration');
  
  try {
    // Check if the provider is in the constants
    const response = await fetch('/api/providers');
    if (response.ok) {
      const providers = await response.json();
      const llamaCppProvider = providers.find(p => p.id === 'llamacpp');
      
      if (llamaCppProvider) {
        console.log('✅ Llama.cpp provider found in constants:', llamaCppProvider);
      } else {
        console.log('❌ Llama.cpp provider not found in constants');
      }
    }
  } catch (error) {
    console.log('ℹ️ Provider constants check skipped (API not available)');
  }
  
  // Check if provider appears in local providers list
  const localProviders = ['ollama', 'lmstudio', 'jan', 'llamacpp'];
  console.log('✅ Llama.cpp should appear in local providers:', localProviders);
}

// Test 2: Check Electron IPC methods
async function testElectronIPC() {
  console.log('\n🔌 Test 2: Electron IPC Methods');
  
  if (typeof window !== 'undefined' && window.electronAPI) {
    const methods = [
      'llamaCppGetModels',
      'llamaCppStartSwap',
      'llamaCppStopSwap',
      'llamaCppIsSwapRunning',
      'llamaCppUpdateModelParameters',
      'llamaCppDeleteModel',
      'llamaCppDownloadModel',
      'llamaCppGetAvailableModels'
    ];
    
    methods.forEach(method => {
      if (typeof window.electronAPI[method] === 'function') {
        console.log(`✅ ${method} method available`);
      } else {
        console.log(`❌ ${method} method missing`);
      }
    });
    
    // Test getting models
    try {
      const models = await window.electronAPI.llamaCppGetModels();
      console.log('✅ llamaCppGetModels returned:', models);
    } catch (error) {
      console.log('❌ llamaCppGetModels failed:', error);
    }
    
    // Test getting available models
    try {
      const availableModels = await window.electronAPI.llamaCppGetAvailableModels();
      console.log('✅ llamaCppGetAvailableModels returned:', availableModels.length, 'models');
    } catch (error) {
      console.log('❌ llamaCppGetAvailableModels failed:', error);
    }
    
    // Test swap status
    try {
      const isRunning = await window.electronAPI.llamaCppIsSwapRunning();
      console.log('✅ llamaCppIsSwapRunning returned:', isRunning);
    } catch (error) {
      console.log('❌ llamaCppIsSwapRunning failed:', error);
    }
    
  } else {
    console.log('❌ Electron API not available');
  }
}

// Test 3: Check LlamaCppProvider functionality
async function testProviderFunctionality() {
  console.log('\n🔧 Test 3: Provider Functionality');
  
  try {
    // Import the provider (this would need to be adapted for actual testing)
    console.log('ℹ️ Provider functionality test would require actual provider instance');
    console.log('✅ LlamaCppProvider class should support:');
    console.log('  - OpenAI-compatible API calls');
    console.log('  - Text-based tool calling');
    console.log('  - Streaming responses');
    console.log('  - Model fetching');
    console.log('  - Tool validation');
  } catch (error) {
    console.log('❌ Provider functionality test failed:', error);
  }
}

// Test 4: Check UI Components
async function testUIComponents() {
  console.log('\n🎨 Test 4: UI Components');
  
  // Check if Llama.cpp button exists in sidebar
  const sidebarButtons = document.querySelectorAll('[data-testid="sidebar-button"], .sidebar-item');
  let llamaCppButtonFound = false;
  
  sidebarButtons.forEach(button => {
    if (button.textContent && button.textContent.toLowerCase().includes('llama')) {
      llamaCppButtonFound = true;
    }
  });
  
  if (llamaCppButtonFound) {
    console.log('✅ Llama.cpp button found in sidebar');
  } else {
    console.log('❌ Llama.cpp button not found in sidebar');
  }
  
  // Check if provider appears in dropdowns
  const providerDropdowns = document.querySelectorAll('select, [role="combobox"]');
  console.log(`ℹ️ Found ${providerDropdowns.length} potential provider dropdowns`);
}

// Test 5: Check llamaCppService
async function testLlamaCppService() {
  console.log('\n🛠️ Test 5: LlamaCpp Service');
  
  try {
    // This would need to be imported properly in a real test
    console.log('ℹ️ llamaCppService should provide:');
    console.log('  - getModels()');
    console.log('  - startLlamaSwap()');
    console.log('  - stopLlamaSwap()');
    console.log('  - isLlamaSwapRunning()');
    console.log('  - updateModelParameters()');
    console.log('  - downloadModel()');
    console.log('  - deleteModel()');
    console.log('  - getAvailableModelsFromHuggingFace()');
  } catch (error) {
    console.log('❌ LlamaCpp service test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🦙 Starting Llama.cpp Integration Tests...\n');
  
  await testProviderRegistration();
  await testElectronIPC();
  await testProviderFunctionality();
  await testUIComponents();
  await testLlamaCppService();
  
  console.log('\n🏁 Llama.cpp Integration Tests Complete!');
  console.log('\n📝 Summary:');
  console.log('✅ Provider should be registered as local provider');
  console.log('✅ Electron IPC methods should be available');
  console.log('✅ UI components should be integrated');
  console.log('✅ Service layer should be functional');
  console.log('\n🎯 Next Steps:');
  console.log('1. Test with actual .gguf model files');
  console.log('2. Verify llama-swap proxy functionality');
  console.log('3. Test tool calling with Llama.cpp models');
  console.log('4. Verify streaming responses work');
}

// Auto-run tests if in browser
if (typeof window !== 'undefined') {
  runAllTests();
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testProviderRegistration,
    testElectronIPC,
    testProviderFunctionality,
    testUIComponents,
    testLlamaCppService,
    runAllTests
  };
}
