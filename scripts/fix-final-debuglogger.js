#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to add safeDebugLog function to files that need it
function addSafeDebugLog(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if file has safeDebugLog calls but no function definition
    const hasSafeDebugLogCalls = content.includes('safeDebugLog(');
    const hasSafeDebugLogFunction = content.includes('function safeDebugLog');
    
    if (hasSafeDebugLogCalls && !hasSafeDebugLogFunction) {
      // Calculate the correct relative path to debugLogger
      const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'src', 'services', 'debugLogger'));
      const debugLoggerPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      const normalizedPath = debugLoggerPath.replace(/\\/g, '/');
      
      // Find the best place to insert the function
      let insertIndex = 0;
      
      // Try to find after imports
      const importRegex = /^import\s+.*?;$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        insertIndex = lastImportIndex + lastImport.length;
      } else {
        // If no imports, try to find after initial comments/interfaces
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith('interface') && !line.startsWith('type') && !line.startsWith('export interface') && !line.startsWith('export type')) {
            insertIndex = content.indexOf(lines[i]);
            break;
          }
        }
      }
      
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
}

`;
      
      content = content.slice(0, insertIndex) + ssrSafeHelper + content.slice(insertIndex);
      modified = true;
    }
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Added safeDebugLog to: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// List of files that need fixing
const filesToFix = [
  'src/config/colors.ts',
  'src/services/providers/prompts/jan.ts',
  'src/services/providers/prompts/ollama.ts',
  'src/services/providers/shared/OpenAICompatibleStreaming.ts',
  'src/services/providers/utils.ts',
  'src/services/initializationManager.ts',
  'src/services/mcpService.ts',
  'src/services/memoryService.ts',
  'src/services/mistralFileService.ts',
  'src/services/OpenAIFileService.ts',
  'src/services/ProgressMonitorService.ts',
  'src/services/stateService.ts',
  'src/services/themeSyncService.ts',
  'src/utils/knowledgeBaseUtils.ts',
  'src/components/ui/electron-dropdown.tsx',
  'src/components/ui/mcp-dropdown.tsx',
  'src/components/ui/provider-dropdown.tsx',
  'src/components/ui/provider-logo.tsx',
  'src/components/ui/searchable-select.tsx'
];

// Main execution
function main() {
  console.log('Adding safeDebugLog function to remaining files...');
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const relativePath of filesToFix) {
    const fullPath = path.join(__dirname, '..', relativePath);
    processedCount++;
    
    if (fs.existsSync(fullPath)) {
      const wasModified = addSafeDebugLog(fullPath);
      if (wasModified) {
        modifiedCount++;
      }
    } else {
      console.log(`File not found: ${fullPath}`);
    }
  }
  
  console.log(`\nCompleted: ${processedCount} files processed, ${modifiedCount} files modified`);
}

main();
