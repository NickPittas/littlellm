#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to revert safeDebugLog calls back to debugLogger for files with imports
function revertSafeDebugLog(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if file has debugLogger import
    const hasDebugLoggerImport = content.includes('import { debugLogger }') || content.includes("import { debugLogger }");
    
    // If file has debugLogger import, revert safeDebugLog calls back to debugLogger
    if (hasDebugLoggerImport && content.includes('safeDebugLog(')) {
      // Revert safeDebugLog('info', calls
      content = content.replace(/safeDebugLog\('info',\s*/g, 'debugLogger.info(');
      
      // Revert safeDebugLog('warn', calls
      content = content.replace(/safeDebugLog\('warn',\s*/g, 'debugLogger.warn(');
      
      // Revert safeDebugLog('error', calls
      content = content.replace(/safeDebugLog\('error',\s*/g, 'debugLogger.error(');
      
      modified = true;
    }
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Reverted safeDebugLog calls in: ${filePath}`);
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
  console.log('Reverting safeDebugLog calls for files with debugLogger imports...');
  
  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const file of tsFiles) {
    processedCount++;
    const wasModified = revertSafeDebugLog(file);
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
