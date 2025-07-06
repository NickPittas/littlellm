const fs = require('fs');
const path = require('path');

// For now, let's just copy the SVG to the assets directory and update the config
// Electron-builder should be able to handle SVG to ICO conversion automatically

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const assetsPath = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsPath)) {
  fs.mkdirSync(assetsPath, { recursive: true });
}

// Copy SVG to assets
const targetPath = path.join(assetsPath, 'icon.svg');
fs.copyFileSync(svgPath, targetPath);

console.log('Icon copied to assets directory');
console.log('SVG path:', targetPath);
