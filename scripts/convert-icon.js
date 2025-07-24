import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePngPath = path.join(__dirname, '..', 'assets', 'LittleLLM.png');

// Convert to different PNG sizes for ICO
const sizes = [16, 32, 48, 64, 128, 256];

async function convertIcon() {
  console.log('Converting LittleLLM.png to various icon formats...');

  if (!fs.existsSync(sourcePngPath)) {
    console.error('Source PNG not found:', sourcePngPath);
    return;
  }

  for (const size of sizes) {
    try {
      const outputPath = path.join(__dirname, '..', 'assets', `icon-${size}.png`);
      await sharp(sourcePngPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Created ${size}x${size} PNG: ${outputPath}`);
    } catch (error) {
      console.error(`Error creating ${size}x${size} PNG:`, error.message);
    }
  }

  // Create a 256x256 PNG as the main icon
  try {
    const mainIconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    await sharp(sourcePngPath)
      .resize(256, 256)
      .png()
      .toFile(mainIconPath);
    console.log(`Created main icon: ${mainIconPath}`);
  } catch (error) {
    console.error('Error creating main PNG:', error.message);
  }
}

convertIcon().catch(console.error);
