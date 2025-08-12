#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix debugLogger paths in a file
function fixDebugLoggerPaths(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Calculate the correct relative path to debugLogger
    const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'src', 'services', 'debugLogger'));
    const debugLoggerPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
    const normalizedPath = debugLoggerPath.replace(/\\/g, '/');
    
    // Fix incorrect paths to debugLogger
    const incorrectPaths = [
      '../services/debugLogger',
      './services/debugLogger',
      'services/debugLogger'
    ];
    
    for (const incorrectPath of incorrectPaths) {
      const regex = new RegExp(`require\\('${incorrectPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, `require('${normalizedPath}')`);
        modified = true;
      }
    }
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed debugLogger paths in: ${filePath}`);
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
  console.log('Fixing debugLogger paths in all TypeScript files...');
  
  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const file of tsFiles) {
    processedCount++;
    const wasModified = fixDebugLoggerPaths(file);
    if (wasModified) {
      modifiedCount++;
    }
  }
  
  console.log(`\nCompleted: ${processedCount} files processed, ${modifiedCount} files modified`);
}

main();
