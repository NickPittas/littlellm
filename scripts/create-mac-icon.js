import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script creates a proper .icns file for macOS from the existing PNG files
// It uses the iconutil command which is available on macOS

const assetsDir = path.join(__dirname, '..', 'assets');
const icnsPath = path.join(assetsDir, 'icon.icns');

console.log('Creating macOS .icns icon file...');

// Check if we're running on macOS
const isMacOS = process.platform === 'darwin';

if (!isMacOS) {
  console.log('⚠️ Not running on macOS. Creating a fallback .icns file from PNG...');

  // For non-macOS systems, we'll copy the largest PNG as a fallback
  const fallbackPng = path.join(assetsDir, 'icon-256.png');
  if (fs.existsSync(fallbackPng)) {
    fs.copyFileSync(fallbackPng, icnsPath.replace('.icns', '.png'));
    console.log('✓ Created fallback PNG file for macOS icon');
  } else {
    console.log('❌ No suitable PNG file found for fallback');
  }
  process.exit(0);
}

try {
  // Create iconset directory structure
  const iconsetDir = path.join(assetsDir, 'icon.iconset');
  
  // Remove existing iconset if it exists
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(iconsetDir, { recursive: true });
  
  // Define the required icon sizes for macOS
  const iconSizes = [
    { size: 16, name: 'icon_16x16.png', source: 'icon-16.png' },
    { size: 32, name: 'icon_16x16@2x.png', source: 'icon-32.png' },
    { size: 32, name: 'icon_32x32.png', source: 'icon-32.png' },
    { size: 64, name: 'icon_32x32@2x.png', source: 'icon-64.png' },
    { size: 128, name: 'icon_128x128.png', source: 'icon-128.png' },
    { size: 256, name: 'icon_128x128@2x.png', source: 'icon-256.png' },
    { size: 256, name: 'icon_256x256.png', source: 'icon-256.png' },
    { size: 512, name: 'icon_256x256@2x.png', source: 'icon-256.png' }, // Use 256 as fallback
    { size: 512, name: 'icon_512x512.png', source: 'icon-256.png' }, // Use 256 as fallback
    { size: 1024, name: 'icon_512x512@2x.png', source: 'icon-256.png' } // Use 256 as fallback
  ];
  
  // Copy and resize icons to iconset directory
  for (const iconSpec of iconSizes) {
    const sourcePath = path.join(assetsDir, iconSpec.source);
    const targetPath = path.join(iconsetDir, iconSpec.name);
    
    if (fs.existsSync(sourcePath)) {
      // For exact size matches, just copy
      if (iconSpec.source.includes(iconSpec.size.toString()) || iconSpec.size <= 256) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✓ Copied ${iconSpec.name}`);
      } else {
        // For larger sizes, we'll use the 256px version as fallback
        fs.copyFileSync(path.join(assetsDir, 'icon-256.png'), targetPath);
        console.log(`✓ Created ${iconSpec.name} (using 256px fallback)`);
      }
    } else {
      // Use the largest available PNG as fallback
      const fallbackPath = path.join(assetsDir, 'icon-256.png');
      if (fs.existsSync(fallbackPath)) {
        fs.copyFileSync(fallbackPath, targetPath);
        console.log(`✓ Created ${iconSpec.name} (using fallback)`);
      }
    }
  }
  
  // Convert iconset to icns using iconutil
  console.log('Converting iconset to .icns...');
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' });
  
  // Clean up iconset directory
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  
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

console.log('macOS icon creation complete!');
