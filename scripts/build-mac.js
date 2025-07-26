import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🍎 Building LittleLLM for macOS...\n');

// Check if we're on macOS
const isMacOS = process.platform === 'darwin';
if (!isMacOS) {
  console.log('⚠️ Warning: Building for macOS from a non-macOS system.');
  console.log('Some features like .icns generation and code signing may not work properly.\n');
}

try {
  // Step 1: Create macOS icon if on macOS
  if (isMacOS) {
    console.log('🎨 Creating macOS icon (.icns)...');
    try {
      execSync('npm run create-mac-icon', { stdio: 'inherit' });
    } catch {
      console.log('⚠️ Icon creation failed, continuing with existing icons...');
    }
  }
  
  // Step 2: Build Next.js app
  console.log('📦 Building Next.js application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Step 3: Build Electron
  console.log('⚡ Building Electron application...');
  execSync('npm run build-electron', { stdio: 'inherit' });
  
  // Step 4: Build macOS DMG
  console.log('💿 Building macOS DMG installer...');
  execSync('electron-builder --mac --config.mac.target=dmg --publish=never', { stdio: 'inherit' });
  
  // Step 5: Build macOS ZIP (for direct distribution)
  console.log('📦 Building macOS ZIP archive...');
  execSync('electron-builder --mac --config.mac.target=zip --publish=never', { stdio: 'inherit' });
  
  console.log('\n✅ macOS build completed successfully!');
  console.log('\n📁 Output files:');
  
  // List the generated files
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    const macFiles = files.filter(file => 
      file.includes('mac') || 
      file.endsWith('.dmg') || 
      file.endsWith('.zip') ||
      file.includes('darwin')
    );
    
    macFiles.forEach(file => {
      const filePath = path.join(distDir, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   📄 ${file} (${sizeInMB} MB)`);
    });
  }
  
  console.log('\n🎉 macOS build process completed!');
  
  if (!isMacOS) {
    console.log('\n⚠️ Note: Since this was built on a non-macOS system:');
    console.log('   • The app may not be properly signed');
    console.log('   • Users may need to allow the app in System Preferences > Security & Privacy');
    console.log('   • Consider building on macOS for distribution');
  } else {
    console.log('\n📝 Next steps:');
    console.log('   • Test the DMG installer on different macOS versions');
    console.log('   • For distribution, consider code signing with a Developer ID');
    console.log('   • For App Store distribution, additional entitlements may be needed');
  }
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  console.error('\nTroubleshooting tips:');
  console.error('   • Ensure all dependencies are installed: npm install');
  console.error('   • Check that Node.js version is 18 or higher');
  console.error('   • On macOS, ensure Xcode Command Line Tools are installed');
  console.error('   • Try cleaning node_modules and reinstalling: rm -rf node_modules && npm install');
  process.exit(1);
}
