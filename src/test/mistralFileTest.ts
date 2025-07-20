// Test file for Mistral file upload and processing capabilities
// This is a simple test to validate the implementation

import { MistralFileService } from '../services/mistralFileService';

// Mock file for testing
function createMockFile(name: string, type: string, size: number = 1024): File {
  const content = new Array(size).fill('a').join('');
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

// Test file validation
export function testFileValidation() {
  console.log('🧪 Testing Mistral file validation...');

  // Test supported file types
  const supportedFiles = [
    createMockFile('test.pdf', 'application/pdf'),
    createMockFile('test.png', 'image/png'),
    createMockFile('test.jpg', 'image/jpeg'),
    createMockFile('test.txt', 'text/plain'),
    createMockFile('test.csv', 'text/csv'),
  ];

  supportedFiles.forEach(file => {
    const validation = MistralFileService.isFileSupported(file);
    console.log(`✅ ${file.name} (${file.type}): ${validation.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    if (!validation.supported) {
      console.log(`   Reason: ${validation.reason}`);
    }
  });

  // Test unsupported file types
  const unsupportedFiles = [
    createMockFile('test.exe', 'application/x-executable'),
    createMockFile('test.zip', 'application/zip'),
  ];

  unsupportedFiles.forEach(file => {
    const validation = MistralFileService.isFileSupported(file);
    console.log(`❌ ${file.name} (${file.type}): ${validation.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    if (!validation.supported) {
      console.log(`   Reason: ${validation.reason}`);
    }
  });

  // Test file size limits
  const largeFile = createMockFile('large.pdf', 'application/pdf', 600 * 1024 * 1024); // 600MB
  const validation = MistralFileService.isFileSupported(largeFile);
  console.log(`📏 Large file (600MB): ${validation.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
  if (!validation.supported) {
    console.log(`   Reason: ${validation.reason}`);
  }

  console.log('✅ File validation tests completed');
}

// Test file service initialization
export function testFileServiceInit() {
  console.log('🧪 Testing Mistral file service initialization...');

  try {
    const fileService = new MistralFileService('test-api-key');
    console.log('✅ MistralFileService initialized successfully');
    return fileService;
  } catch (error) {
    console.error('❌ Failed to initialize MistralFileService:', error);
    return null;
  }
}

// Test file preparation for vision models
export async function testFilePreparation() {
  console.log('🧪 Testing file preparation for vision models...');

  const fileService = testFileServiceInit();
  if (!fileService) {
    console.error('❌ Cannot test file preparation without file service');
    return;
  }

  // Test image file preparation
  const imageFile = createMockFile('test.png', 'image/png');
  try {
    const preparedImage = await fileService.prepareFileForVision(imageFile);
    console.log('✅ Image file prepared:', {
      type: preparedImage.type,
      hasImageUrl: !!preparedImage.image_url,
      hasText: !!preparedImage.text
    });
  } catch (error) {
    console.error('❌ Failed to prepare image file:', error);
  }

  // Test PDF file preparation
  const pdfFile = createMockFile('test.pdf', 'application/pdf');
  try {
    const preparedPdf = await fileService.prepareFileForVision(pdfFile);
    console.log('✅ PDF file prepared:', {
      type: preparedPdf.type,
      hasImageUrl: !!preparedPdf.image_url,
      hasText: !!preparedPdf.text
    });
  } catch (error) {
    console.error('❌ Failed to prepare PDF file:', error);
  }

  console.log('✅ File preparation tests completed');
}

// Run all tests
export function runAllTests() {
  console.log('🚀 Starting Mistral file upload tests...');
  console.log('=====================================');

  testFileValidation();
  console.log('');

  testFileServiceInit();
  console.log('');

  testFilePreparation();
  console.log('');

  console.log('=====================================');
  console.log('✅ All Mistral file upload tests completed');
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).mistralFileTests = {
    runAllTests,
    testFileValidation,
    testFileServiceInit,
    testFilePreparation
  };
}
