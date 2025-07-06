const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

async function createIcoIcon() {
  try {
    console.log('Creating ICO icon from PNG files...');
    
    // Use multiple PNG sizes to create a proper ICO file
    const pngFiles = [
      path.join(__dirname, '..', 'assets', 'icon-16.png'),
      path.join(__dirname, '..', 'assets', 'icon-32.png'),
      path.join(__dirname, '..', 'assets', 'icon-48.png'),
      path.join(__dirname, '..', 'assets', 'icon-64.png'),
      path.join(__dirname, '..', 'assets', 'icon-128.png'),
      path.join(__dirname, '..', 'assets', 'icon-256.png')
    ];
    
    // Check if all PNG files exist
    for (const pngFile of pngFiles) {
      if (!fs.existsSync(pngFile)) {
        console.error(`PNG file not found: ${pngFile}`);
        return;
      }
    }
    
    // Convert to ICO
    const icoBuffer = await pngToIco(pngFiles);
    
    // Save ICO file
    const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    
    console.log(`✅ ICO icon created: ${icoPath}`);
    console.log(`ICO file size: ${icoBuffer.length} bytes`);
    
  } catch (error) {
    console.error('Error creating ICO icon:', error);
  }
}

createIcoIcon();
