/**
 * Test the actual internal command implementation
 * This tests the real ElectronInternalCommandHandler class
 */

import { ElectronInternalCommandHandler } from './src/electron/internalCommandHandler.ts';
import os from 'os';
import path from 'path';

async function testInternalCommands() {
  console.log('🔧 Testing Actual Internal Command Handler on Windows');
  console.log('=' * 50);

  // Create handler instance
  const handler = new ElectronInternalCommandHandler();

  // Configure the handler
  const config = {
    enabled: true,
    allowedDirectories: [
      os.homedir(),
      process.cwd(),
      os.tmpdir()
    ],
    blockedCommands: [
      'format', 'fdisk', 'del /f /s /q C:\\', 'shutdown', 'reboot'
    ],
    fileReadLineLimit: 1000,
    fileWriteLineLimit: 100,
    defaultShell: 'powershell',
    enabledCommands: {
      terminal: true,
      filesystem: true,
      textEditing: true,
      system: true,
    },
    terminalSettings: {
      defaultTimeout: 30000,
      maxProcesses: 10,
      allowInteractiveShells: true,
    },
  };

  await handler.setConfig(config);
  console.log('✅ Handler configured');

  // Test 1: Terminal Command
  console.log('\n📅 Test 1: Terminal Command (Get-Date)');
  try {
    const result = await handler.executeCommand('start_process', {
      command: 'Get-Date',
      timeout_ms: 10000,
      shell: 'powershell'
    });
    
    if (result.success) {
      console.log('✅ Success:', result.content[0].text.substring(0, 100));
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: System Command - CPU Usage
  console.log('\n📊 Test 2: CPU Usage');
  try {
    const result = await handler.executeCommand('get_cpu_usage', {});
    
    if (result.success) {
      console.log('✅ Success:', result.content[0].text.substring(0, 100));
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: System Command - Memory Usage
  console.log('\n🧠 Test 3: Memory Usage');
  try {
    const result = await handler.executeCommand('get_memory_usage', {});
    
    if (result.success) {
      console.log('✅ Success:', result.content[0].text.substring(0, 100));
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 4: File Operations
  console.log('\n📄 Test 4: File Operations');
  const testFile = path.join(os.tmpdir(), 'littlellm-test.txt');
  
  try {
    // Write file
    const writeResult = await handler.executeCommand('write_file', {
      path: testFile,
      content: 'Hello from LiteLLM internal commands test!',
      append: false
    });
    
    if (writeResult.success) {
      console.log('✅ File written successfully');
      
      // Read file
      const readResult = await handler.executeCommand('read_file', {
        path: testFile
      });
      
      if (readResult.success) {
        console.log('✅ File read successfully:', readResult.content[0].text.substring(0, 50));
        
        // Delete file
        const deleteResult = await handler.executeCommand('delete_file', {
          path: testFile,
          useRecycleBin: true
        });
        
        if (deleteResult.success) {
          console.log('✅ File deleted successfully');
        } else {
          console.log('❌ Delete failed:', deleteResult.error);
        }
      } else {
        console.log('❌ Read failed:', readResult.error);
      }
    } else {
      console.log('❌ Write failed:', writeResult.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 5: Process List
  console.log('\n🔄 Test 5: Process List');
  try {
    const result = await handler.executeCommand('list_processes', {});
    
    if (result.success) {
      console.log('✅ Success: Process list retrieved');
      console.log('First 200 chars:', result.content[0].text.substring(0, 200));
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 6: Get Available Tools
  console.log('\n🔧 Test 6: Available Tools');
  try {
    const tools = await handler.getAvailableTools();
    console.log(`✅ Success: Found ${tools.length} available tools`);
    
    const toolsByCategory = {};
    tools.forEach(tool => {
      if (!toolsByCategory[tool.category]) {
        toolsByCategory[tool.category] = [];
      }
      toolsByCategory[tool.category].push(tool.name);
    });
    
    console.log('Tools by category:');
    Object.keys(toolsByCategory).forEach(category => {
      console.log(`  ${category}: ${toolsByCategory[category].join(', ')}`);
    });
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🎉 Internal Commands Test Complete!');
}

// Run the test
testInternalCommands().catch(console.error);
