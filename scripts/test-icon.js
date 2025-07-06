const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Test script to verify icon loading
function testIconPaths() {
  console.log('Testing icon paths...');
  
  const possiblePaths = [
    path.join(__dirname, '../assets/icon.ico'),
    path.join(__dirname, '../../assets/icon.ico'),
    path.join(process.resourcesPath, 'assets/icon.ico'),
    path.join(app.getAppPath(), 'assets/icon.ico'),
  ];

  console.log('App path:', app.getAppPath());
  console.log('Resources path:', process.resourcesPath);
  console.log('__dirname:', __dirname);

  for (const iconPath of possiblePaths) {
    const exists = fs.existsSync(iconPath);
    console.log(`${iconPath}: ${exists ? '✓ EXISTS' : '✗ NOT FOUND'}`);
    
    if (exists) {
      try {
        const image = nativeImage.createFromPath(iconPath);
        console.log(`  - Image loaded: ${!image.isEmpty()}`);
        console.log(`  - Image size: ${image.getSize().width}x${image.getSize().height}`);
      } catch (error) {
        console.log(`  - Error loading image: ${error.message}`);
      }
    }
  }
}

app.whenReady().then(() => {
  testIconPaths();
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});
