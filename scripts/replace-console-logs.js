#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping of console methods to debugLogger methods
const consoleToDebugLogger = {
  'console.log': 'debugLogger.info',
  'console.info': 'debugLogger.info',
  'console.warn': 'debugLogger.warn',
  'console.error': 'debugLogger.error',
  'console.debug': 'debugLogger.debug'
};

// Function to get component name from file path
function getComponentName(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

// Function to process a single file
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if debugLogger is already imported
    const hasDebugLoggerImport = content.includes('debugLogger');
    
    // Add debugLogger import if not present
    if (!hasDebugLoggerImport) {
      // Find the last import statement
      const importRegex = /^import\s+.*?;$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertIndex = lastImportIndex + lastImport.length;
        
        // Determine the relative path to debugLogger
        const relativePath = path.relative(path.dirname(filePath), 'src/services/debugLogger');
        const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
        const debugLoggerImport = `\nimport { debugLogger } from '${importPath.replace(/\\/g, '/')}';`;
        
        content = content.slice(0, insertIndex) + debugLoggerImport + content.slice(insertIndex);
        modified = true;
      }
    }
    
    const componentName = getComponentName(filePath);
    
    // Replace console statements
    for (const [consoleMethod, debugMethod] of Object.entries(consoleToDebugLogger)) {
      const regex = new RegExp(`\\b${consoleMethod.replace('.', '\\.')}\\s*\\(`, 'g');
      const replacement = `${debugMethod}('${componentName}', `;
      
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        modified = true;
      }
    }
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
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
  console.log('Looking for files in:', srcDir);
  const tsFiles = findTsFiles(srcDir);

  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const file of tsFiles) {
    processedCount++;
    const wasModified = processFile(file);
    if (wasModified) {
      modifiedCount++;
    }
    
    // Progress indicator
    if (processedCount % 10 === 0) {
      console.log(`Progress: ${processedCount}/${tsFiles.length} files processed, ${modifiedCount} modified`);
    }
  }
  
  console.log(`\nCompleted: ${processedCount} files processed, ${modifiedCount} files modified`);
}

// Run the main function
main();
