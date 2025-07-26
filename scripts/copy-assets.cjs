#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

function copyAssets() {
  const sourceDir = path.join(__dirname, '..', 'assets');
  const publicDir = path.join(__dirname, '..', 'public', 'assets');
  const outDir = path.join(__dirname, '..', 'out', 'assets');

  // Ensure directories exist
  if (!fs.existsSync(path.join(__dirname, '..', 'public'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'public'), { recursive: true });
  }
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Copy assets to public directory (for development)
  if (fs.existsSync(sourceDir)) {
    copyRecursive(sourceDir, publicDir);
    console.log('✅ Assets copied to public directory');
  }

  // Copy assets to out directory (for production)
  if (fs.existsSync(sourceDir)) {
    copyRecursive(sourceDir, outDir);
    console.log('✅ Assets copied to out directory');
  }
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (require.main === module) {
  copyAssets();
}

module.exports = { copyAssets };
