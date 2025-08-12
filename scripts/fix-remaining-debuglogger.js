#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix debugLogger imports and add safeDebugLog
function fixDebugLoggerFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if file has debugLogger import and safeDebugLog calls
    const hasDebugLoggerImport = content.includes('import { debugLogger }') || content.includes("import { debugLogger }");
    const hasSafeDebugLogCalls = content.includes('safeDebugLog(');
    const hasSafeDebugLogFunction = content.includes('function safeDebugLog');
    
    // If file has debugLogger import and safeDebugLog calls, we need to fix it
    if (hasDebugLoggerImport && hasSafeDebugLogCalls && !hasSafeDebugLogFunction) {
      // Remove the debugLogger import line
      content = content.replace(/import\s*{\s*debugLogger\s*}\s*from\s*['"][^'"]*debugLogger['"];\s*\n?/g, '');
      
      // Calculate the correct relative path to debugLogger
      const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'src', 'services', 'debugLogger'));
      const debugLoggerPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      const normalizedPath = debugLoggerPath.replace(/\\/g, '/');
      
      // Find the last import statement to add safeDebugLog function after it
      const importRegex = /^import\s+.*?;$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertIndex = lastImportIndex + lastImport.length;
        
        const ssrSafeHelper = `

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](\`[\${prefix}]\`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('${normalizedPath}');
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
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed debugLogger in: ${filePath}`);
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
  console.log('Fixing remaining debugLogger issues...');
  
  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const file of tsFiles) {
    processedCount++;
    const wasModified = fixDebugLoggerFile(file);
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
