#!/usr/bin/env node

/**
 * Bundle analysis script for LittleLLM
 * Analyzes bundle size, identifies large dependencies, and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BUILD_DIR = path.join(process.cwd(), 'out');
const ANALYSIS_OUTPUT = path.join(process.cwd(), 'reports');

// Ensure reports directory exists
if (!fs.existsSync(ANALYSIS_OUTPUT)) {
  fs.mkdirSync(ANALYSIS_OUTPUT, { recursive: true });
}

/**
 * Get file size in a human-readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Analyze JavaScript files in the build directory
 */
function analyzeJavaScriptFiles() {
  console.log('📊 Analyzing JavaScript files...');
  
  const jsFiles = [];
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.js')) {
        const relativePath = path.relative(BUILD_DIR, filePath);
        jsFiles.push({
          name: file,
          path: relativePath,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size)
        });
      }
    }
  }
  
  if (fs.existsSync(BUILD_DIR)) {
    scanDirectory(BUILD_DIR);
  } else {
    console.error('❌ Build directory not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  // Sort by size (largest first)
  jsFiles.sort((a, b) => b.size - a.size);
  
  return jsFiles;
}

/**
 * Analyze CSS files in the build directory
 */
function analyzeCSSFiles() {
  console.log('🎨 Analyzing CSS files...');
  
  const cssFiles = [];
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.css')) {
        const relativePath = path.relative(BUILD_DIR, filePath);
        cssFiles.push({
          name: file,
          path: relativePath,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size)
        });
      }
    }
  }
  
  if (fs.existsSync(BUILD_DIR)) {
    scanDirectory(BUILD_DIR);
  }
  
  // Sort by size (largest first)
  cssFiles.sort((a, b) => b.size - a.size);
  
  return cssFiles;
}

/**
 * Analyze package.json dependencies
 */
function analyzeDependencies() {
  console.log('📦 Analyzing dependencies...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  
  // Get dependency sizes (approximate)
  const heavyDependencies = [
    '@xenova/transformers',
    'pdfjs-dist',
    'react-syntax-highlighter',
    '@radix-ui/react-icons',
    'framer-motion',
    'mammoth',
    'xlsx',
    'lancedb'
  ];
  
  const foundHeavyDeps = heavyDependencies.filter(dep => 
    dependencies[dep] || devDependencies[dep]
  );
  
  return {
    totalDependencies: Object.keys(dependencies).length,
    totalDevDependencies: Object.keys(devDependencies).length,
    heavyDependencies: foundHeavyDeps,
    dependencies,
    devDependencies
  };
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(jsFiles, cssFiles, deps) {
  const recommendations = [];
  
  // Check for large JavaScript files
  const largeJsFiles = jsFiles.filter(file => file.size > 100 * 1024); // > 100KB
  if (largeJsFiles.length > 0) {
    recommendations.push({
      type: 'warning',
      category: 'Bundle Size',
      title: 'Large JavaScript files detected',
      description: `Found ${largeJsFiles.length} JavaScript files larger than 100KB`,
      files: largeJsFiles.slice(0, 5).map(f => `${f.name} (${f.sizeFormatted})`),
      suggestions: [
        'Implement code splitting for large components',
        'Use dynamic imports for heavy libraries',
        'Consider lazy loading for non-critical features'
      ]
    });
  }
  
  // Check for heavy dependencies
  if (deps.heavyDependencies.length > 0) {
    recommendations.push({
      type: 'info',
      category: 'Dependencies',
      title: 'Heavy dependencies found',
      description: `Found ${deps.heavyDependencies.length} potentially heavy dependencies`,
      files: deps.heavyDependencies,
      suggestions: [
        'Use dynamic imports for heavy libraries',
        'Consider lighter alternatives where possible',
        'Implement tree shaking for icon libraries'
      ]
    });
  }
  
  // Check total bundle size
  const totalJsSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalJsSize > 2 * 1024 * 1024) { // > 2MB
    recommendations.push({
      type: 'error',
      category: 'Performance',
      title: 'Total bundle size is very large',
      description: `Total JavaScript size: ${formatBytes(totalJsSize)}`,
      suggestions: [
        'Implement aggressive code splitting',
        'Remove unused dependencies',
        'Use webpack-bundle-analyzer for detailed analysis'
      ]
    });
  }
  
  // Check for duplicate chunks
  const chunkFiles = jsFiles.filter(file => file.name.includes('chunk') || file.name.includes('vendors'));
  if (chunkFiles.length > 20) {
    recommendations.push({
      type: 'warning',
      category: 'Bundle Structure',
      title: 'Too many chunks detected',
      description: `Found ${chunkFiles.length} chunk files`,
      suggestions: [
        'Optimize webpack splitChunks configuration',
        'Merge small chunks to reduce HTTP requests',
        'Review chunk splitting strategy'
      ]
    });
  }
  
  return recommendations;
}

/**
 * Generate detailed report
 */
function generateReport(jsFiles, cssFiles, deps, recommendations) {
  const totalJsSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
  const totalCssSize = cssFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSize = totalJsSize + totalCssSize;
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: jsFiles.length + cssFiles.length,
      totalSize: formatBytes(totalSize),
      totalJsSize: formatBytes(totalJsSize),
      totalCssSize: formatBytes(totalCssSize),
      largestJsFile: jsFiles[0] ? `${jsFiles[0].name} (${jsFiles[0].sizeFormatted})` : 'None',
      dependencies: deps.totalDependencies,
      heavyDependencies: deps.heavyDependencies.length
    },
    files: {
      javascript: jsFiles.slice(0, 10), // Top 10 largest
      css: cssFiles.slice(0, 5) // Top 5 largest
    },
    dependencies: deps,
    recommendations,
    performance: {
      score: calculatePerformanceScore(totalSize, recommendations),
      metrics: {
        bundleSize: totalSize,
        jsSize: totalJsSize,
        cssSize: totalCssSize,
        fileCount: jsFiles.length + cssFiles.length
      }
    }
  };
  
  return report;
}

/**
 * Calculate a performance score based on bundle size and issues
 */
function calculatePerformanceScore(totalSize, recommendations) {
  let score = 100;
  
  // Deduct points for large bundle size
  const sizeMB = totalSize / (1024 * 1024);
  if (sizeMB > 5) score -= 30;
  else if (sizeMB > 3) score -= 20;
  else if (sizeMB > 2) score -= 10;
  else if (sizeMB > 1) score -= 5;
  
  // Deduct points for recommendations
  recommendations.forEach(rec => {
    switch (rec.type) {
      case 'error': score -= 15; break;
      case 'warning': score -= 10; break;
      case 'info': score -= 5; break;
    }
  });
  
  return Math.max(0, score);
}

/**
 * Save report to file
 */
function saveReport(report) {
  const reportPath = path.join(ANALYSIS_OUTPUT, 'bundle-analysis.json');
  const markdownPath = path.join(ANALYSIS_OUTPUT, 'bundle-analysis.md');
  
  // Save JSON report
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Generate Markdown report
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(markdownPath, markdown);
  
  console.log(`📄 Reports saved:`);
  console.log(`   JSON: ${reportPath}`);
  console.log(`   Markdown: ${markdownPath}`);
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(report) {
  const { summary, files, recommendations, performance } = report;
  
  let markdown = `# Bundle Analysis Report\n\n`;
  markdown += `Generated: ${new Date(report.timestamp).toLocaleString()}\n\n`;
  
  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Performance Score**: ${performance.score}/100\n`;
  markdown += `- **Total Size**: ${summary.totalSize}\n`;
  markdown += `- **JavaScript**: ${summary.totalJsSize}\n`;
  markdown += `- **CSS**: ${summary.totalCssSize}\n`;
  markdown += `- **Files**: ${summary.totalFiles}\n`;
  markdown += `- **Dependencies**: ${summary.dependencies}\n`;
  markdown += `- **Heavy Dependencies**: ${summary.heavyDependencies}\n\n`;
  
  // Largest files
  markdown += `## Largest JavaScript Files\n\n`;
  markdown += `| File | Size | Path |\n`;
  markdown += `|------|------|------|\n`;
  files.javascript.forEach(file => {
    markdown += `| ${file.name} | ${file.sizeFormatted} | ${file.path} |\n`;
  });
  markdown += `\n`;
  
  // Recommendations
  if (recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    recommendations.forEach(rec => {
      const icon = rec.type === 'error' ? '🚨' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
      markdown += `### ${icon} ${rec.title}\n\n`;
      markdown += `**Category**: ${rec.category}\n\n`;
      markdown += `${rec.description}\n\n`;
      if (rec.files && rec.files.length > 0) {
        markdown += `**Files**:\n`;
        rec.files.forEach(file => markdown += `- ${file}\n`);
        markdown += `\n`;
      }
      markdown += `**Suggestions**:\n`;
      rec.suggestions.forEach(suggestion => markdown += `- ${suggestion}\n`);
      markdown += `\n`;
    });
  }
  
  return markdown;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Starting bundle analysis...\n');
  
  try {
    const jsFiles = analyzeJavaScriptFiles();
    const cssFiles = analyzeCSSFiles();
    const deps = analyzeDependencies();
    const recommendations = generateRecommendations(jsFiles, cssFiles, deps);
    const report = generateReport(jsFiles, cssFiles, deps, recommendations);
    
    saveReport(report);
    
    // Print summary to console
    console.log('\n📊 Analysis Summary:');
    console.log(`   Performance Score: ${report.performance.score}/100`);
    console.log(`   Total Size: ${report.summary.totalSize}`);
    console.log(`   Recommendations: ${recommendations.length}`);
    
    if (recommendations.length > 0) {
      console.log('\n🔧 Top Recommendations:');
      recommendations.slice(0, 3).forEach(rec => {
        const icon = rec.type === 'error' ? '🚨' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${rec.title}`);
      });
    }
    
    console.log('\n✅ Bundle analysis complete!');
    
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeJavaScriptFiles,
  analyzeCSSFiles,
  analyzeDependencies,
  generateRecommendations,
  generateReport
};
