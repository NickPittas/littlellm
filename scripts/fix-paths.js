import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixPaths() {
  const outDir = path.join(__dirname, '..', 'out');
  const indexPath = path.join(outDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found');
    return;
  }

  // No path fixing needed for HTTP server - absolute paths work fine
  console.log('Verified index.html exists - no path changes needed for HTTP server');

  // Check CSS files exist
  const cssDir = path.join(outDir, '_next', 'static', 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    cssFiles.forEach(file => {
      console.log(`Verified CSS file: ${file}`);
    });
  }
}

fixPaths();
