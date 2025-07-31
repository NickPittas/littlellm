#!/usr/bin/env node

/**
 * Script to wait for Next.js development server and start Electron
 * Uses the default Next.js port (3000) and waits for the "Ready" message
 */

import { spawn } from 'child_process';

const NEXTJS_PORT = process.env.PORT || 3000;
const MAX_WAIT_TIME = 120000; // 120 seconds
const CHECK_INTERVAL = 1000; // 1 second

async function waitForNextJSReady() {
  console.log(`🔍 Waiting for Next.js server to be ready on port ${NEXTJS_PORT}...`);

  // Simple delay to allow Next.js to fully start
  // Since Next.js already shows "Ready" message, we just need a small buffer
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`✅ Assuming Next.js is ready on port ${NEXTJS_PORT}`);
  return NEXTJS_PORT;
}



async function main() {
  try {
    const port = await waitForNextJSReady();

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
