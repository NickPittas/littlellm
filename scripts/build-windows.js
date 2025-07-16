import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Building LittleLLM for Windows...');
console.log('This will create both installer and portable versions.\n');

// Ensure we're in the right directory
const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

try {
  // Step 1: Build Next.js app
  console.log('📦 Building Next.js application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Step 2: Build Electron
  console.log('⚡ Building Electron application...');
  execSync('npm run build-electron', { stdio: 'inherit' });
  
  // Step 3: Build Windows installer
  console.log('🔧 Building Windows installer (NSIS)...');
  execSync('electron-builder --win --config.win.target=nsis --publish=never', { stdio: 'inherit' });
  
  // Step 4: Build portable version
  console.log('📱 Building portable executable...');
  execSync('electron-builder --win --config.win.target=portable --publish=never', { stdio: 'inherit' });
  
  console.log('\n✅ Build completed successfully!');
  console.log('\n📁 Output files:');
  
  // List the generated files
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter(file => 
      file.endsWith('.exe') || file.endsWith('.msi')
    );
    
    files.forEach(file => {
      const filePath = path.join(distDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      if (file.includes('Setup')) {
        console.log(`   🔧 Installer: ${file} (${sizeInMB} MB)`);
      } else {
        console.log(`   📱 Portable: ${file} (${sizeInMB} MB)`);
      }
    });
  }
  
  console.log('\n🎉 Ready for distribution!');
  console.log('\nInstaller features:');
  console.log('   • Full Windows installation with uninstaller');
  console.log('   • Desktop and Start Menu shortcuts');
  console.log('   • Optional auto-start with Windows');
  console.log('   • Proper Windows integration');
  console.log('   • Add/Remove Programs entry');
  
  console.log('\nPortable features:');
  console.log('   • Single executable file');
  console.log('   • No installation required');
  console.log('   • Run from any location');
  console.log('   • Perfect for USB drives');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
