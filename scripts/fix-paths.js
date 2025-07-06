const fs = require('fs');
const path = require('path');

function fixPaths() {
  const outDir = path.join(__dirname, '..', 'out');
  const indexPath = path.join(outDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found');
    return;
  }

  // Fix index.html - use localhost URLs for Electron
  let content = fs.readFileSync(indexPath, 'utf8');
  content = content.replace(/href="\/_next\//g, 'href="http://localhost:3001/_next/');
  content = content.replace(/src="\/_next\//g, 'src="http://localhost:3001/_next/');
  fs.writeFileSync(indexPath, content);
  console.log('Fixed paths in index.html with localhost URLs');

  // Fix CSS files
  const cssDir = path.join(outDir, '_next', 'static', 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    cssFiles.forEach(file => {
      const cssPath = path.join(cssDir, file);
      let cssContent = fs.readFileSync(cssPath, 'utf8');

      // Fix font URLs in CSS
      cssContent = cssContent.replace(/url\(\/_next\//g, 'url(./_next/');
      cssContent = cssContent.replace(/url\(\/static\//g, 'url(./static/');

      fs.writeFileSync(cssPath, cssContent);
      console.log(`Fixed paths in ${file}`);
    });
  }
}

fixPaths();
