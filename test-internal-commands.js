/**
 * Comprehensive test file for internal commands
 * This will test each tool individually and report results
 */

const { ipcRenderer } = require('electron');

// List of all 14 tools that should be available
const EXPECTED_TOOLS = [
  // Terminal tools (6)
  'start_process',
  'read_process_output', 
  'interact_with_process',
  'force_terminate',
  'list_sessions',
  'kill_process',
  // Filesystem tools (7)
  'read_file',
  'write_file', 
  'create_directory',
  'list_directory',
  'move_file',
  'search_files',
  'get_file_info',
  // Text editing tools (1)
  'edit_block'
];

async function testInternalCommand(toolName, args = {}) {
  console.log(`\n🧪 Testing tool: ${toolName}`);
  console.log(`📋 Args:`, JSON.stringify(args, null, 2));

  try {
    const startTime = Date.now();
    const result = await ipcRenderer.invoke('execute-internal-command', {
      tool: toolName,
      args: args
    });
    const duration = Date.now() - startTime;

    console.log(`✅ Tool ${toolName} executed successfully in ${duration}ms`);
    console.log(`📊 Result structure:`, {
      success: result?.success,
      hasContent: result?.content?.length > 0,
      contentTypes: result?.content?.map(c => c.type),
      hasError: !!result?.error
    });

    // Show actual content for successful results
    if (result?.success && result?.content) {
      const textContent = result.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      if (textContent) {
        console.log(`📝 Content preview (first 200 chars):`, textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
      }
    }

    return { tool: toolName, success: true, result, duration };
  } catch (error) {
    console.log(`❌ Tool ${toolName} failed:`, error.message);
    return { tool: toolName, success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive internal command tests...\n');
  
  const results = [];
  
  // Test each tool with appropriate arguments (safe, non-destructive tests)
  const testCases = [
    // Terminal tools (safe commands)
    { tool: 'list_processes', args: {}, description: 'List running processes' },
    { tool: 'list_sessions', args: {}, description: 'List active terminal sessions' },
    { tool: 'start_process', args: { command: 'echo "Hello from internal command test"', timeout_ms: 5000 }, description: 'Start a simple echo process' },

    // Filesystem tools (read-only operations first)
    { tool: 'list_directory', args: { path: 'C:\\Users\\npitt\\Downloads' }, description: 'List Downloads directory' },
    { tool: 'get_file_info', args: { path: 'C:\\Users\\npitt\\Downloads' }, description: 'Get Downloads directory info' },
    { tool: 'search_files', args: { path: 'C:\\Users\\npitt\\Downloads', pattern: '*.txt' }, description: 'Search for .txt files' },

    // Test with a file that might exist
    { tool: 'read_file', args: { path: 'C:\\Users\\npitt\\Downloads\\nick.txt' }, description: 'Read nick.txt if it exists' },

    // Safe write operations (create test file)
    { tool: 'write_file', args: { path: 'C:\\Users\\npitt\\Downloads\\internal-command-test.txt', content: 'This is a test file created by internal command testing.\nTimestamp: ' + new Date().toISOString() }, description: 'Create test file' },

    // Test reading the file we just created
    { tool: 'read_file', args: { path: 'C:\\Users\\npitt\\Downloads\\internal-command-test.txt' }, description: 'Read the test file we created' },

    // Test directory creation (safe)
    { tool: 'create_directory', args: { path: 'C:\\Users\\npitt\\Downloads\\test-internal-commands' }, description: 'Create test directory' },

    // Test file operations that might fail gracefully
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
      console.log(`  - ${s.tool}`);
    });
  }
  
  return results;
}

// Run tests when this file is executed
if (typeof window !== 'undefined') {
  // Browser environment
  window.testInternalCommands = runAllTests;
  console.log('🧪 Test functions loaded. Run window.testInternalCommands() to start tests.');
} else {
  // Node environment
  runAllTests().then(() => {
    console.log('\n🏁 All tests completed!');
  }).catch(error => {
    console.error('💥 Test runner failed:', error);
  });
}
