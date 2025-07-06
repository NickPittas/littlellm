const fs = require('fs');
const path = require('path');
const svg2img = require('svg2img');

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Convert to different PNG sizes for ICO
const sizes = [16, 32, 48, 64, 128, 256];

async function convertIcon() {
  console.log('Converting SVG to PNG formats...');
  
  for (const size of sizes) {
    try {
      const pngBuffer = await new Promise((resolve, reject) => {
        svg2img(svgContent, { width: size, height: size }, (error, buffer) => {
          if (error) reject(error);
          else resolve(buffer);
        });
      });
      
      const outputPath = path.join(__dirname, '..', 'assets', `icon-${size}.png`);
      fs.writeFileSync(outputPath, pngBuffer);
      console.log(`Created ${size}x${size} PNG: ${outputPath}`);
    } catch (error) {
      console.error(`Error creating ${size}x${size} PNG:`, error.message);
    }
  }
  
  // Create a 256x256 PNG as the main icon
  try {
    const mainPngBuffer = await new Promise((resolve, reject) => {
      svg2img(svgContent, { width: 256, height: 256 }, (error, buffer) => {
        if (error) reject(error);
        else resolve(buffer);
      });
    });
    
    const mainIconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    fs.writeFileSync(mainIconPath, mainPngBuffer);
    console.log(`Created main icon: ${mainIconPath}`);
  } catch (error) {
    console.error('Error creating main PNG:', error.message);
  }
}

convertIcon().catch(console.error);
