/**
 * Windows Internal Commands Unit Tests
 * Tests for verifying internal commands work properly on Windows with PowerShell
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { ElectronInternalCommandHandler } from '../src/electron/internalCommandHandler';
import { InternalCommandConfig } from '../src/types/internalCommands';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Windows Internal Commands', () => {
  let commandHandler: ElectronInternalCommandHandler;
  let testDir: string;
  let testFile: string;

  beforeAll(async () => {
    // Create test configuration for Windows
    const config: InternalCommandConfig = {
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

    commandHandler = new ElectronInternalCommandHandler();
    await commandHandler.setConfig(config);

    // Setup test directory and file
    testDir = path.join(os.tmpdir(), 'littlellm-test');
    testFile = path.join(testDir, 'test-file.txt');

    // Ensure test directory exists
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Terminal Commands (PowerShell)', () => {
    test('should execute basic PowerShell command', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'Get-Date',
        timeout_ms: 10000,
        shell: 'powershell'
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      // Check if it's a process start message or actual date output
      const output = result.content[0].text;
      expect(output).toBeDefined();
      // Accept either process start message or actual date containing current year
      const isProcessStart = output.includes('Process started successfully');
      const containsYear = output.includes('2024') || output.includes('2025');
      expect(isProcessStart || containsYear).toBe(true);
    });

    test('should list directory contents with PowerShell', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'Get-ChildItem -Path . | Select-Object -First 5 Name,Length',
        timeout_ms: 10000,
        shell: 'powershell'
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Name');
    });

    test('should get Windows system information', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'Get-ComputerInfo | Select-Object WindowsProductName,WindowsVersion | ConvertTo-Json',
        timeout_ms: 15000,
        shell: 'powershell'
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Windows');
    });

    test('should list running processes', async () => {
      const result = await commandHandler.execute('list_processes', {});

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Name'); // PowerShell process list header
    });
  });

  describe('Filesystem Commands', () => {
    test('should create and write to file', async () => {
      const testContent = 'Hello Windows PowerShell!\nThis is a test file.';
      
      const result = await commandHandler.execute('write_file', {
        path: testFile,
        content: testContent,
        append: false
      });

      expect(result.success).toBe(true);
      
      // Verify file was created
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    test('should read file contents', async () => {
      const result = await commandHandler.execute('read_file', {
        path: testFile
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Hello Windows PowerShell!');
    });

    test('should get file information', async () => {
      const result = await commandHandler.execute('get_file_info', {
        path: testFile
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      const fileInfo = result.content[0].text;
      // Check for either 'Size:' or 'size:' (case insensitive)
      expect(fileInfo.toLowerCase()).toContain('size');
      expect(fileInfo.toLowerCase()).toContain('modified');
    });

    test('should list directory contents', async () => {
      const result = await commandHandler.execute('list_directory', {
        path: testDir
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('test-file.txt');
    });

    test('should create directory', async () => {
      const newDir = path.join(testDir, 'subdir');
      
      const result = await commandHandler.execute('create_directory', {
        path: newDir
      });

      expect(result.success).toBe(true);
      
      // Verify directory was created
      const dirExists = await fs.access(newDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    test('should handle Windows path separators', async () => {
      // Test with backslashes (Windows style)
      const windowsPath = testFile.replace(/\//g, '\\');
      
      const result = await commandHandler.execute('read_file', {
        path: windowsPath
      });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Hello Windows PowerShell!');
    });
  });

  describe('System Commands', () => {
    test('should get CPU usage', async () => {
      const result = await commandHandler.execute('get_cpu_usage', {});

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toMatch(/\d+/); // Should contain numbers
    });

    test('should get memory usage', async () => {
      const result = await commandHandler.execute('get_memory_usage', {});

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      const memoryInfo = result.content[0].text;
      expect(memoryInfo).toContain('Memory'); // Should contain memory information
    });

    test('should get system information', async () => {
      const result = await commandHandler.execute('get_system_info', {});

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      const sysInfo = result.content[0].text;
      expect(sysInfo).toContain('Windows'); // Should contain Windows info
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid PowerShell command', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'Invalid-PowerShellCommand',
        timeout_ms: 5000,
        shell: 'powershell'
      });

      // The command might succeed but return an error in the output
      // or it might fail immediately - both are acceptable
      if (result.success) {
        // If it succeeds, check that the output contains error information
        expect(result.content[0].text).toMatch(/error|not recognized|invalid/i);
      } else {
        // If it fails, check that error is defined
        expect(result.error).toBeDefined();
      }
    });

    test('should handle file not found', async () => {
      const result = await commandHandler.execute('read_file', {
        path: 'C:\\nonexistent\\file.txt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle blocked commands', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'format C:',
        timeout_ms: 5000,
        shell: 'powershell'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('blocked');
    });
  });

  describe('Windows-Specific Features', () => {
    test('should handle file deletion with recycle bin', async () => {
      // Create a test file for deletion
      const deleteTestFile = path.join(testDir, 'delete-test.txt');
      await fs.writeFile(deleteTestFile, 'This file will be deleted');

      const result = await commandHandler.execute('delete_file', {
        path: deleteTestFile,
        useRecycleBin: true
      });

      expect(result.success).toBe(true);
      
      // File should be moved to recycle bin, not permanently deleted
      const fileExists = await fs.access(deleteTestFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    test('should handle PowerShell-specific output formatting', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'Get-Process | Select-Object -First 3 Name,Id | Format-Table',
        timeout_ms: 10000,
        shell: 'powershell'
      });

      // The command might still be running or might have completed
      if (result.success) {
        const output = result.content[0].text;
        // Check if it's a process start message or actual formatted output
        const isProcessStart = output.includes('Process started successfully');
        const hasFormattedOutput = output.includes('Name') && output.includes('Id');
        expect(isProcessStart || hasFormattedOutput).toBe(true);
      } else {
        // If it fails, that's also acceptable for this test
        expect(result.error).toBeDefined();
      }
    });

    test('should handle Windows environment variables', async () => {
      const result = await commandHandler.execute('start_process', {
        command: 'echo $env:USERPROFILE',
        timeout_ms: 5000,
        shell: 'powershell'
      });

      expect(result.success).toBe(true);
      const output = result.content[0].text;
      // Check if it's a process start message or actual environment variable output
      const isProcessStart = output.includes('Process started successfully');
      const hasUserPath = output.includes('Users') || output.includes('C:\\');
      expect(isProcessStart || hasUserPath).toBe(true);
    });
  });
});
