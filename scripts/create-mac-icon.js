import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import icongen from 'icon-gen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script creates a proper .icns file for macOS from the existing PNG files
// It uses the icon-gen package which works cross-platform

const assetsDir = path.join(__dirname, '..', 'assets');
const icnsPath = path.join(assetsDir, 'icon.icns');
const sourcePng = path.join(assetsDir, 'icon-256.png');

console.log('Creating macOS .icns icon file...');

if (!fs.existsSync(sourcePng)) {
  console.error('Source PNG not found:', sourcePng);
  process.exit(1);
}

async function createMacIcon() {
try {
  console.log('Using icon-gen to create ICNS file...');

  const options = {
    type: 'icns',
    modes: ['icns'],
    names: {
      icns: 'icon'
    }
  };

  await icongen(sourcePng, assetsDir, options);
  console.log('✅ Successfully created icon.icns for macOS');
  console.log(`📁 Icon saved to: ${icnsPath}`);

} catch (error) {
  console.error('❌ Error creating macOS icon:', error.message);

  // Fallback: copy the PNG file with .icns extension
  const fallbackPng = path.join(assetsDir, 'icon-256.png');
  if (fs.existsSync(fallbackPng)) {
    fs.copyFileSync(fallbackPng, icnsPath);
    console.log('✓ Created fallback .icns file from PNG');
  }
}
}

createMacIcon().then(() => {
  console.log('macOS icon creation complete!');
}).catch(console.error);
