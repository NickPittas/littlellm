#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix debugLogger SSR issues in a file
function fixDebugLoggerSSR(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if file already has safeDebugLog function
    const hasSafeDebugLog = content.includes('function safeDebugLog');

    // If file uses debugLogger and doesn't have safeDebugLog, add SSR-safe helper
    if (!hasSafeDebugLog && content.includes('debugLogger.')) {
      // Add SSR-safe helper at the top after imports
      const importRegex = /^import\s+.*?;$/gm;
      const imports = content.match(importRegex);

      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertIndex = lastImportIndex + lastImport.length;

        // Calculate the correct relative path to debugLogger
        const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'src', 'services', 'debugLogger'));
        const debugLoggerPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;

        const ssrSafeHelper = `

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](\`[\${prefix}]\`, ...args);
    return;
  }

  try {
    const { debugLogger } = require('${debugLoggerPath.replace(/\\/g, '/')}');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](\`[\${prefix}]\`, ...args);
    }
  } catch {
    console[level](\`[\${prefix}]\`, ...args);
  }
}`;

        content = content.slice(0, insertIndex) + ssrSafeHelper + content.slice(insertIndex);
        modified = true;
      }
    }

    // Replace debugLogger.info calls
    const infoRegex = /debugLogger\.info\(/g;
    if (infoRegex.test(content)) {
      content = content.replace(infoRegex, 'safeDebugLog(\'info\', ');
      modified = true;
    }

    // Replace debugLogger.warn calls
    const warnRegex = /debugLogger\.warn\(/g;
    if (warnRegex.test(content)) {
      content = content.replace(warnRegex, 'safeDebugLog(\'warn\', ');
      modified = true;
    }

    // Replace debugLogger.error calls
    const errorRegex = /debugLogger\.error\(/g;
    if (errorRegex.test(content)) {
      content = content.replace(errorRegex, 'safeDebugLog(\'error\', ');
      modified = true;
    }

    // Replace debugLogger.debug calls
    const debugRegex = /debugLogger\.debug\(/g;
    if (debugRegex.test(content)) {
      content = content.replace(debugRegex, 'safeDebugLog(\'info\', ');
      modified = true;
    }

    // Replace debugLogger.logToolExecution calls (special case)
    const toolExecRegex = /debugLogger\.logToolExecution\(/g;
    if (toolExecRegex.test(content)) {
      content = content.replace(toolExecRegex, 'safeDebugLog(\'info\', \'TOOL_EXECUTION\', ');
      modified = true;
    }

    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed debugLogger SSR issues in: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find TypeScript/TSX files
function findTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

// Main execution
function main() {
  const srcDir = path.join(__dirname, '..', 'src');
  console.log('Fixing debugLogger SSR issues in all TypeScript files...');

  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);

  let processedCount = 0;
  let modifiedCount = 0;

  for (const file of tsFiles) {
    processedCount++;
    const wasModified = fixDebugLoggerSSR(file);
    if (wasModified) {
      modifiedCount++;
    }

    // Progress indicator
    if (processedCount % 20 === 0) {
      console.log(`Progress: ${processedCount}/${tsFiles.length} files processed, ${modifiedCount} modified`);
    }
  }

  console.log(`\nCompleted: ${processedCount} files processed, ${modifiedCount} files modified`);
}

main();
