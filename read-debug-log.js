import fs from 'fs';
import path from 'path';
import os from 'os';

// Try to read the debug log file
function readDebugLog() {
  try {
    // Windows AppData path
    const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const logPath = path.join(appDataPath, 'LittleLLM', 'debug', 'debug.log');
    
    console.log('Looking for debug log at:', logPath);
    
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8');
      console.log('\n=== DEBUG LOG CONTENT ===');
      console.log('File path:', logPath);
      console.log('File size:', content.length, 'characters');
      console.log('Content:');
      console.log(content);
      console.log('\n=== END OF DEBUG LOG ===');
    } else {
      console.log('Debug log file does not exist at:', logPath);
      
      // Try to find any LittleLLM directories
      const littleLLMPath = path.join(appDataPath, 'LittleLLM');
      if (fs.existsSync(littleLLMPath)) {
        console.log('LittleLLM directory exists, checking contents...');
        const contents = fs.readdirSync(littleLLMPath, { withFileTypes: true });
        contents.forEach(item => {
          console.log(`  ${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`);
          if (item.isDirectory() && item.name === 'debug') {
            const debugPath = path.join(littleLLMPath, 'debug');
            const debugContents = fs.readdirSync(debugPath);
            debugContents.forEach(file => {
              console.log(`    [FILE] ${file}`);
            });
          }
        });
      } else {
        console.log('LittleLLM directory does not exist at:', littleLLMPath);
      }
    }
  } catch (error) {
    console.error('Error reading debug log:', error.message);
  }
}

readDebugLog();
