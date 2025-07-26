/**
 * Utility to read and analyze API key test results
 */

async function readLatestTestResults() {
  if (typeof window !== 'undefined' && window.electronAPI?.getStateFile) {
    try {
      // Try to read the latest test file
      const files = ['api-key-test-latest.log'];
      
      for (const filename of files) {
        try {
          const content = await window.electronAPI.getStateFile(filename);
          if (content) {
            console.log('📄 Test Results from', filename);
            console.log('=' .repeat(50));
            console.log(content);
            console.log('=' .repeat(50));
            
            // Analyze results
            analyzeTestResults(content);
            return content;
          }
        } catch (error) {
          console.log('⚠️ Could not read', filename);
        }
      }
      
      console.log('❌ No test results found');
    } catch (error) {
      console.error('❌ Failed to read test results:', error);
    }
  } else {
    console.log('❌ Electron API not available');
  }
}

function analyzeTestResults(content: string) {
  console.log('\n🔍 ANALYSIS:');
  
  const lines = content.split('\n');
  
  // Check for key indicators
  const serviceAvailable = lines.some(line => line.includes('Secure API key service available: true'));
  const serviceInitialized = lines.some(line => line.includes('Service initialized: true'));
  const saveButtonFound = lines.some(line => line.includes('Save button found: true'));
  const redBackgroundFound = lines.some(line => line.includes('Red background test area found: true'));
  
  console.log('✅ Service Available:', serviceAvailable);
  console.log('✅ Service Initialized:', serviceInitialized);
  console.log('✅ Save Button Found:', saveButtonFound);
  console.log('✅ Red Background Found:', redBackgroundFound);
  
  // Find specific issues
  if (!saveButtonFound) {
    console.log('❌ ISSUE: Save button not found in DOM');
  }
  
  if (!redBackgroundFound) {
    console.log('❌ ISSUE: Red background test area not found - component may not be rendering');
  }
  
  // Check for container issues
  const scrollableContent = lines.find(line => line.includes('Content area is scrollable:'));
  if (scrollableContent) {
    console.log('📏 Container:', scrollableContent);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).readLatestTestResults = readLatestTestResults;
  console.log('📄 Test result reader loaded: window.readLatestTestResults()');
}

export { readLatestTestResults, analyzeTestResults };
