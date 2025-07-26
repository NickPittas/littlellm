/**
 * Comprehensive test suite for internal commands
 * This can be run from the browser console to test all tools
 */

interface TestResult {
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
  description: string;
}

interface TestCase {
  tool: string;
  args: Record<string, any>;
  description: string;
}

export async function testInternalCommand(toolName: string, args: Record<string, any> = {}): Promise<TestResult> {
  console.log(`\n🧪 Testing tool: ${toolName}`);
  console.log(`📋 Args:`, JSON.stringify(args, null, 2));
  
  try {
    const startTime = Date.now();
    
    // Use the window.electronAPI if available
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.executeInternalCommand(toolName, args);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Tool ${toolName} executed successfully in ${duration}ms`);
      console.log(`📊 Result structure:`, {
        success: result?.success,
        hasContent: result?.content?.length > 0,
        contentTypes: result?.content?.map((c: any) => c.type),
        hasError: !!result?.error
      });
      
      // Show actual content for successful results
      if (result?.success && result?.content) {
        const textContent = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');
        
        if (textContent) {
          console.log(`📝 Content preview (first 200 chars):`, textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
        }
      }
      
      return { tool: toolName, success: true, result, duration, description: '' };
    } else {
      throw new Error('Electron API not available');
    }
  } catch (error) {
    console.log(`❌ Tool ${toolName} failed:`, error instanceof Error ? error.message : String(error));
    return { tool: toolName, success: false, error: error instanceof Error ? error.message : String(error), description: '' };
  }
}

export async function runAllInternalCommandTests(): Promise<TestResult[]> {
  console.log('🚀 Starting comprehensive internal command tests...\n');
  
  const results: TestResult[] = [];
  
  // Test cases (safe, non-destructive tests)
  const testCases: TestCase[] = [
    // Terminal tools (safe commands)
    { tool: 'list_processes', args: {}, description: 'List running processes' },
    { tool: 'list_sessions', args: {}, description: 'List active terminal sessions' },
    { tool: 'start_process', args: { command: 'echo "Hello from internal command test"', timeout_ms: 5000 }, description: 'Start a simple echo process' },
    
    // Filesystem tools (read-only operations first)
    { tool: 'list_directory', args: { path: 'C:\\Users\\npitt\\Downloads' }, description: 'List Downloads directory' },
    { tool: 'get_file_info', args: { path: 'C:\\Users\\npitt\\Downloads' }, description: 'Get Downloads directory info' },
    { tool: 'search_files', args: { path: 'C:\\Users\\npitt\\Downloads', pattern: '*.txt' }, description: 'Search for .txt files' },
    
    // Safe write operations (create test file)
    { tool: 'write_file', args: { path: 'C:\\Users\\npitt\\Downloads\\internal-command-test.txt', content: 'This is a test file created by internal command testing.\nTimestamp: ' + new Date().toISOString() }, description: 'Create test file' },
    
    // Test reading the file we just created
    { tool: 'read_file', args: { path: 'C:\\Users\\npitt\\Downloads\\internal-command-test.txt' }, description: 'Read the test file we created' },
    
    // Test directory creation (safe)
    { tool: 'create_directory', args: { path: 'C:\\Users\\npitt\\Downloads\\test-internal-commands' }, description: 'Create test directory' },
    
    // Test file operations
    { tool: 'move_file', args: { source: 'C:\\Users\\npitt\\Downloads\\internal-command-test.txt', destination: 'C:\\Users\\npitt\\Downloads\\test-internal-commands\\moved-test.txt' }, description: 'Move test file to test directory' },
    
    // Text editing (on our test file)
    { tool: 'edit_block', args: { file_path: 'C:\\Users\\npitt\\Downloads\\test-internal-commands\\moved-test.txt', old_string: 'test file', new_string: 'EDITED test file' }, description: 'Edit the moved test file' },
    
    // Terminal tools that might fail (test error handling)
    { tool: 'read_process_output', args: { pid: 99999 }, description: 'Try to read from non-existent process (should fail gracefully)' },
    { tool: 'interact_with_process', args: { pid: 99999, input: 'test' }, description: 'Try to interact with non-existent process (should fail gracefully)' },
    { tool: 'force_terminate', args: { pid: 99999 }, description: 'Try to terminate non-existent process (should fail gracefully)' },
    { tool: 'kill_process', args: { pid: 99999 }, description: 'Try to kill non-existent process (should fail gracefully)' }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🎯 Test: ${testCase.description}`);
    const result = await testInternalCommand(testCase.tool, testCase.args);
    result.description = testCase.description;
    results.push(result);
    
    // Small delay between tests to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED TOOLS:');
    failed.forEach(f => {
      console.log(`  - ${f.tool}: ${f.error}`);
    });
  }
  
  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFUL TOOLS:');
    successful.forEach(s => {
      console.log(`  - ${s.tool}: ${s.description}`);
    });
  }
  
  return results;
}

// Test API Key Settings component internal state
function testApiKeySettings() {
  console.log('🧪 Testing API Key Settings component...');

  try {
    // First, check if settings overlay is open
    const settingsOverlay = document.querySelector('[role="dialog"]') || document.querySelector('.settings-overlay');
    console.log('✅ Settings overlay found:', !!settingsOverlay);

    // Try to open settings if not open
    if (!settingsOverlay) {
      const settingsButton = document.querySelector('button[aria-label*="Settings"]') ||
                            document.querySelector('button[title*="Settings"]') ||
                            Array.from(document.querySelectorAll('button')).find(btn =>
                              btn.textContent?.toLowerCase().includes('settings') ||
                              btn.innerHTML.includes('gear') ||
                              btn.innerHTML.includes('cog')
                            );
      console.log('✅ Settings button found:', !!settingsButton);

      if (settingsButton) {
        console.log('🔄 Clicking settings button...');
        (settingsButton as HTMLElement).click();
        // Wait a moment for the overlay to open
        setTimeout(() => {
          console.log('🔄 Settings button clicked, continuing test...');
          continueTest();
        }, 2000);
        return;
      } else {
        console.log('❌ No settings button found');
      }
    }

    continueTest();

  } catch (error) {
    console.error('❌ API Key Settings test failed:', error);
  }
}

function continueTest() {
  try {
    // Test secure API key service
    const { secureApiKeyService } = require('../services/secureApiKeyService');
    console.log('✅ Secure API key service available:', !!secureApiKeyService);
    console.log('✅ Service initialized:', secureApiKeyService.isInitialized());

    // Test DOM structure and container issues
    const contentArea = document.querySelector('.overflow-y-auto');
    console.log('✅ Content area found:', !!contentArea);
    if (contentArea) {
      console.log('✅ Content area height:', contentArea.clientHeight);
      console.log('✅ Content area scroll height:', contentArea.scrollHeight);
      console.log('✅ Content area is scrollable:', contentArea.scrollHeight > contentArea.clientHeight);
    }

    // Test DOM elements
    const saveButtons = document.querySelectorAll('button');
    const apiKeyInputs = document.querySelectorAll('input[type="password"]');

    console.log('✅ Found buttons in DOM:', saveButtons.length);
    console.log('✅ Found API key inputs:', apiKeyInputs.length);

    // List all buttons to see what's available
    Array.from(saveButtons).forEach((btn, index) => {
      console.log(`✅ Button ${index}:`, btn.textContent?.trim());
    });

    // Test if save button exists with specific text
    const saveButton = Array.from(saveButtons).find(btn =>
      btn.textContent?.includes('Save API Keys')
    );
    console.log('✅ Save button found:', !!saveButton);

    if (saveButton) {
      console.log('✅ Save button disabled:', saveButton.disabled);
      console.log('✅ Save button visible:', saveButton.offsetParent !== null);
      console.log('✅ Save button classes:', saveButton.className);
      console.log('✅ Save button position:', saveButton.getBoundingClientRect());
    }

    // Test if debug info is visible
    const debugInfo = document.querySelector('[class*="bg-gray-100"]');
    console.log('✅ Debug info found:', !!debugInfo);
    if (debugInfo) {
      console.log('✅ Debug info content:', debugInfo.textContent);
    }

    // Test red background save button area
    const redBackground = document.querySelector('[class*="bg-red-100"]');
    console.log('✅ Red background test area found:', !!redBackground);
    if (redBackground) {
      console.log('✅ Red background content:', redBackground.textContent);
      console.log('✅ Red background position:', redBackground.getBoundingClientRect());
    }

    // Test actual input interaction with React events
    if (apiKeyInputs.length > 0) {
      console.log('🧪 Testing input interaction...');
      const firstInput = apiKeyInputs[0] as HTMLInputElement;
      console.log('✅ First input value before:', firstInput.value);
      console.log('✅ Input has onChange handler:', !!(firstInput as any)._valueTracker);

      // Check if React fiber exists
      const reactFiber = (firstInput as any)._reactInternalFiber || (firstInput as any).__reactInternalInstance;
      console.log('✅ React fiber found:', !!reactFiber);

      // Try to trigger React's onChange by simulating user input more realistically
      firstInput.focus();

      // Set value and trigger React's input tracking
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(firstInput, 'test-key-123');

        // Trigger React's synthetic event
        const inputEvent = new Event('input', { bubbles: true });
        firstInput.dispatchEvent(inputEvent);

        const changeEvent = new Event('change', { bubbles: true });
        firstInput.dispatchEvent(changeEvent);
      }

      console.log('✅ First input value after:', firstInput.value);

      // Wait a moment for state to update and check multiple times
      setTimeout(() => {
        console.log('🔍 Checking state after 1 second...');
        const updatedDebugInfo = document.querySelector('[class*="bg-gray-100"]');
        if (updatedDebugInfo) {
          console.log('✅ Debug info after input (1s):', updatedDebugInfo.textContent);
        }

        const updatedSaveButton = Array.from(document.querySelectorAll('button')).find(btn =>
          btn.textContent?.includes('Save API Keys')
        );
        if (updatedSaveButton) {
          console.log('✅ Save button disabled after input (1s):', updatedSaveButton.disabled);
        }

        // Check again after more time
        setTimeout(() => {
          console.log('🔍 Checking state after 3 seconds...');
          const finalDebugInfo = document.querySelector('[class*="bg-gray-100"]');
          if (finalDebugInfo) {
            console.log('✅ Final debug info (3s):', finalDebugInfo.textContent);
          }

          const finalSaveButton = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent?.includes('Save API Keys')
          );
          if (finalSaveButton) {
            console.log('✅ Final save button disabled (3s):', finalSaveButton.disabled);
          }
        }, 2000);
      }, 1000);
    }

    console.log('✅ API Key Settings test completed');
  } catch (error) {
    console.error('❌ API Key Settings test failed:', error);
  }
}

// Auto-run API key settings test and save results
async function autoRunApiKeyTest() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const testOutput: string[] = [];

  // Capture console output
  console.log = (...args) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    testOutput.push(`[LOG] ${message}`);
    originalConsoleLog(...args);
  };

  console.error = (...args) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    testOutput.push(`[ERROR] ${message}`);
    originalConsoleError(...args);
  };

  try {
    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run the test
    testApiKeySettings();

    // Save results to file
    const testResults = testOutput.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (typeof window !== 'undefined' && window.electronAPI?.saveStateFile) {
      // Save with timestamp and as latest
      await window.electronAPI.saveStateFile(`api-key-test-${timestamp}.log`, testResults);
      await window.electronAPI.saveStateFile('api-key-test-latest.log', testResults);
      originalConsoleLog('✅ Test results saved to api-key-test-latest.log and api-key-test-' + timestamp + '.log');
    }

  } catch (error) {
    originalConsoleError('❌ Auto test failed:', error);
  } finally {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
}

// Test API key save integration
function testApiKeySaveIntegration() {
  console.log('🧪 Testing API Key Save Integration...');

  try {
    // Check if settings overlay is open
    const settingsOverlay = document.querySelector('[role="dialog"]') || document.querySelector('.settings-overlay');
    if (!settingsOverlay) {
      console.log('❌ Settings overlay not found, opening...');
      const settingsButton = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.textContent?.toLowerCase().includes('settings')
      );
      if (settingsButton) {
        (settingsButton as HTMLElement).click();
        setTimeout(() => testApiKeySaveIntegration(), 2000);
        return;
      }
    }

    // Find API key input and add a test key
    const apiKeyInputs = document.querySelectorAll('input[type="password"]');
    if (apiKeyInputs.length > 0) {
      const firstInput = apiKeyInputs[0] as HTMLInputElement;
      console.log('✅ Found API key input, adding test key...');

      // Set value and trigger React events
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(firstInput, 'test-integration-key-123');
        firstInput.dispatchEvent(new Event('input', { bubbles: true }));
        firstInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Wait for state to update, then test save
      setTimeout(() => {
        console.log('🔍 Checking if Save Settings button is enabled...');
        const saveSettingsButton = Array.from(document.querySelectorAll('button')).find(btn =>
          btn.textContent?.includes('Save Settings')
        );

        if (saveSettingsButton) {
          console.log('✅ Save Settings button found, disabled:', saveSettingsButton.disabled);
          if (!saveSettingsButton.disabled) {
            console.log('🔄 Clicking Save Settings button...');
            (saveSettingsButton as HTMLElement).click();

            // Check if API key save was triggered
            setTimeout(() => {
              console.log('✅ API Key Save Integration test completed');
            }, 2000);
          } else {
            console.log('❌ Save Settings button is still disabled');
          }
        } else {
          console.log('❌ Save Settings button not found');
        }
      }, 1000);
    } else {
      console.log('❌ No API key inputs found');
    }
  } catch (error) {
    console.error('❌ API Key Save Integration test failed:', error);
  }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testInternalCommands = runAllInternalCommandTests;
  (window as any).testSingleInternalCommand = testInternalCommand;
  (window as any).testApiKeySettings = testApiKeySettings;
  (window as any).autoRunApiKeyTest = autoRunApiKeyTest;
  (window as any).testApiKeySaveIntegration = testApiKeySaveIntegration;

  console.log('🧪 Internal command test functions loaded:');
  console.log('  - window.testInternalCommands() - Run all tests');
  console.log('  - window.testSingleInternalCommand(toolName, args) - Test single tool');
  console.log('  - window.testApiKeySettings() - Test API key component');
  console.log('  - window.autoRunApiKeyTest() - Auto-run and save API key test');
  console.log('  - window.testApiKeySaveIntegration() - Test save integration');

  // Auto-run disabled - cleanup completed
  // setTimeout(() => {
  //   testApiKeySaveIntegration();
  // }, 10000);
}
