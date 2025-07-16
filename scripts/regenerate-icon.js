import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script regenerates the icon files to ensure proper Windows taskbar support
// It creates ICO files with multiple sizes for better Windows compatibility

const assetsDir = path.join(__dirname, '..', 'assets');
const iconIcoPath = path.join(assetsDir, 'icon.ico');

console.log('Regenerating icon files for better Windows taskbar support...');

// Check if we have the required tools
try {
  // First, let's use the existing PNG files to create a proper ICO
  const { default: pngToIco } = await import('png-to-ico');
  
  // Create ICO from multiple PNG sizes
  const pngFiles = [
    path.join(assetsDir, 'icon-16.png'),
    path.join(assetsDir, 'icon-32.png'),
    path.join(assetsDir, 'icon-48.png'),
    path.join(assetsDir, 'icon-64.png'),
    path.join(assetsDir, 'icon-128.png'),
    path.join(assetsDir, 'icon-256.png')
  ].filter(file => fs.existsSync(file));

  if (pngFiles.length > 0) {
    console.log('Creating ICO from PNG files:', pngFiles.map(f => path.basename(f)));

    const buffers = pngFiles.map(file => fs.readFileSync(file));

    // png-to-ico returns a Promise, so we need to handle it properly
    pngToIco(buffers).then(icoBuffer => {
      fs.writeFileSync(iconIcoPath, icoBuffer);
      console.log('✓ Created new icon.ico with multiple sizes');
    }).catch(error => {
      console.error('Error creating ICO:', error.message);
      console.log('Keeping existing ICO file');
    });
  } else {
    console.log('No PNG files found, keeping existing ICO');
  }

} catch (error) {
  console.error('Error regenerating icon:', error.message);
  console.log('Keeping existing icon files');
}

console.log('Icon regeneration complete!');
