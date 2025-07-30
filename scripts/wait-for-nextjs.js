#!/usr/bin/env node

/**
 * Script to detect and wait for Next.js development server
 * This script tries multiple ports and waits for the Next.js server to be ready
 */

import http from 'http';
import { spawn } from 'child_process';

const PORTS_TO_TRY = [3000, 3001, 3002, 3003, 3004, 3005];
const MAX_WAIT_TIME = 60000; // 60 seconds
const CHECK_INTERVAL = 1000; // 1 second

async function detectNextJSPort() {
  for (const port of PORTS_TO_TRY) {
    try {
      const isNextJS = await new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          // Check if this looks like a Next.js server specifically
          const poweredBy = res.headers['x-powered-by'];
          const isNext = poweredBy && poweredBy.includes('Next.js');

          console.log(`🔍 Checking port ${port}: powered-by="${poweredBy}", isNext=${isNext}`);
          resolve(isNext);
        });

        req.on('error', (err) => {
          console.log(`🔍 Port ${port} not accessible: ${err.message}`);
          resolve(false);
        });

        req.setTimeout(2000, () => {
          console.log(`🔍 Port ${port} timeout`);
          req.destroy();
          resolve(false);
        });
      });

      if (isNextJS) {
        return port;
      }
    } catch (err) {
      console.log(`🔍 Error checking port ${port}: ${err.message}`);
      // Continue to next port
    }
  }
  return null;
}

async function waitForNextJS() {
  console.log('🔍 Waiting for Next.js development server...');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_TIME) {
    const port = await detectNextJSPort();
    
    if (port) {
      console.log(`✅ Next.js server detected on port ${port}`);
      return port;
    }
    
    console.log('⏳ Next.js server not ready yet, checking again...');
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
  }
  
  throw new Error('❌ Timeout: Next.js server not found after 60 seconds');
}

async function main() {
  try {
    const port = await waitForNextJS();
    
    // Start Electron with the detected port
    console.log(`🚀 Starting Electron with Next.js on port ${port}...`);

    const electronProcess = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      shell: true, // Use shell to resolve npx path
      env: {
        ...process.env,
        NEXTJS_PORT: port.toString()
      }
    });
    
    electronProcess.on('close', (code) => {
      console.log(`Electron process exited with code ${code}`);
      process.exit(code);
    });
    
    electronProcess.on('error', (error) => {
      console.error('Failed to start Electron:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
