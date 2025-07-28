// Simple test script to verify screenshot functionality
// This can be run in the browser console when the app is running

async function testScreenshotFunctionality() {
  console.log('🧪 Testing Screenshot Functionality...');
  
  try {
    // Check if electronAPI is available
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error('electronAPI not available - not running in Electron environment');
    }
    
    console.log('✅ electronAPI is available');
    
    // Check if takeScreenshot method exists
    if (typeof window.electronAPI.takeScreenshot !== 'function') {
      throw new Error('takeScreenshot method not found on electronAPI');
    }
    
    console.log('✅ takeScreenshot method is available');
    
    // Test the screenshot functionality
    console.log('📸 Attempting to take screenshot...');
    const result = await window.electronAPI.takeScreenshot();
    
    console.log('📸 Screenshot result:', {
      success: result.success,
      hasDataURL: !!result.dataURL,
      dataURLLength: result.dataURL ? result.dataURL.length : 0,
      error: result.error
    });
    
    if (result.success && result.dataURL) {
      console.log('✅ Screenshot captured successfully!');
      console.log(`📊 Screenshot size: ${Math.round(result.dataURL.length / 1024)}KB`);
      
      // Test if we can create a file from the dataURL
      try {
        const response = await fetch(result.dataURL);
        const blob = await response.blob();
        const file = new File([blob], `test-screenshot-${Date.now()}.png`, { type: 'image/png' });
        console.log(`✅ File created: ${file.name} (${Math.round(file.size / 1024)}KB)`);
        
        return {
          success: true,
          message: 'Screenshot functionality is working correctly',
          file: file
        };
      } catch (fileError) {
        console.error('❌ Failed to create file from screenshot:', fileError);
        return {
          success: false,
          message: 'Screenshot captured but failed to create file',
          error: fileError.message
        };
      }
    } else {
      console.error('❌ Screenshot failed:', result.error);
      return {
        success: false,
        message: 'Screenshot capture failed',
        error: result.error
      };
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      message: 'Test failed',
      error: error.message
    };
  }
}

// Make the test function available globally
if (typeof window !== 'undefined') {
  window.testScreenshotFunctionality = testScreenshotFunctionality;
  console.log('🧪 Screenshot test function loaded. Run window.testScreenshotFunctionality() to test.');
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testScreenshotFunctionality };
}
