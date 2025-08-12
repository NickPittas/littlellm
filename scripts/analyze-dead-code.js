#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('🔍 Analyzing dead code and unused dependencies...\n');

// Read all the report files
let eslintResults = [];
let tsPruneResults = [];
let depcheckResults = {};

try {
  eslintResults = JSON.parse(fs.readFileSync('reports/eslint-results.json', 'utf8'));
} catch (error) {
  console.log('⚠️  Could not read ESLint results:', error.message);
}

try {
  const tsPruneRaw = fs.readFileSync('reports/ts-prune-results.json', 'utf8').trim();
  if (tsPruneRaw) {
    tsPruneResults = tsPruneRaw.split('\n').map(line => line.trim()).filter(line => line);
  }
} catch (error) {
  console.log('⚠️  Could not read ts-prune results:', error.message);
}

try {
  depcheckResults = JSON.parse(fs.readFileSync('reports/depcheck-results.json', 'utf8'));
} catch (error) {
  console.log('⚠️  Could not read depcheck results, using manual data:', error.message);
  // Manual depcheck results from CLI output
  depcheckResults = {
    dependencies: [
      '@microsoft/fetch-event-source', '@radix-ui/react-alert-dialog', '@radix-ui/react-toast',
      'color-convert', 'color-name', 'critters', 'electron-is-dev', 'flatbuffers',
      'node-fetch', 'node-loader', 'node-pptx-parser', 'pdf2pic', 'pdfjs-dist', 'sharp'
    ],
    devDependencies: [
      '@testing-library/react', '@types/jest', 'autoprefixer', 'depcheck',
      'electron-icon-builder', 'eslint-config-next', 'eslint-plugin-security',
      'jest-environment-jsdom', 'png-to-ico', 'postcss', 'prettier',
      'svg2img', 'ts-jest', 'ts-prune', 'wait-on'
    ],
    missing: {
      '@jest/globals': ['tests/windows-internal-commands.test.ts'],
      'icon-gen': ['scripts/create-mac-icon.js']
    }
  };
}

// Analyze results
const deadCodeAnalysis = {
  unusedImports: [],
  unusedVariables: [],
  consoleStatements: [],
  deadExports: [],
  unusedDependencies: {
    dependencies: depcheckResults.dependencies || [],
    devDependencies: depcheckResults.devDependencies || []
  },
  missingDependencies: depcheckResults.missing || {},
  typeErrors: [],
  securityIssues: []
};

// Process ESLint results
if (Array.isArray(eslintResults)) {
  eslintResults.forEach(fileResult => {
    if (fileResult.messages && fileResult.messages.length > 0) {
      fileResult.messages.forEach(message => {
        const issue = {
          file: fileResult.filePath.replace(process.cwd(), '').replace(/\\/g, '/'),
          line: message.line,
          column: message.column,
          rule: message.ruleId,
          message: message.message,
          severity: message.severity === 2 ? 'error' : 'warning'
        };

        switch (message.ruleId) {
          case 'unused-imports/no-unused-imports':
          case '@typescript-eslint/no-unused-vars':
          case 'unused-imports/no-unused-vars':
            if (message.message.includes('import')) {
              deadCodeAnalysis.unusedImports.push(issue);
            } else {
              deadCodeAnalysis.unusedVariables.push(issue);
            }
            break;
          case 'no-console':
            deadCodeAnalysis.consoleStatements.push(issue);
            break;
          case 'no-debugger':
          case 'no-unreachable':
          case 'no-empty':
            deadCodeAnalysis.typeErrors.push(issue);
            break;
          default:
            if (message.ruleId && message.ruleId.includes('security')) {
              deadCodeAnalysis.securityIssues.push(issue);
            }
        }
      });
    }
  });
}

// Process ts-prune results for dead exports
tsPruneResults.forEach(line => {
  if (line.includes(' - ') && !line.includes('(used in module)')) {
    const [filePath, symbol] = line.split(' - ');
    deadCodeAnalysis.deadExports.push({
      file: filePath.replace(/\\/g, '/'),
      symbol: symbol,
      type: 'unused export'
    });
  }
});

// Generate summary statistics
const summary = {
  totalIssues: 0,
  unusedImportsCount: deadCodeAnalysis.unusedImports.length,
  unusedVariablesCount: deadCodeAnalysis.unusedVariables.length,
  consoleStatementsCount: deadCodeAnalysis.consoleStatements.length,
  deadExportsCount: deadCodeAnalysis.deadExports.length,
  unusedDependenciesCount: deadCodeAnalysis.unusedDependencies.dependencies.length + deadCodeAnalysis.unusedDependencies.devDependencies.length,
  missingDependenciesCount: Object.keys(deadCodeAnalysis.missingDependencies).length
};

summary.totalIssues = summary.unusedImportsCount + summary.unusedVariablesCount + 
                      summary.consoleStatementsCount + summary.deadExportsCount + 
                      summary.unusedDependenciesCount + summary.missingDependenciesCount;

// Create the comprehensive report
const report = {
  timestamp: new Date().toISOString(),
  summary,
  details: deadCodeAnalysis,
  recommendations: []
};

// Add recommendations based on findings
if (summary.unusedImportsCount > 0) {
  report.recommendations.push('🔧 Run ESLint with --fix to automatically remove unused imports');
}

if (summary.consoleStatementsCount > 0) {
  report.recommendations.push('🧹 Review and remove console.log statements from production code');
}

if (summary.unusedDependenciesCount > 0) {
  report.recommendations.push('📦 Remove unused dependencies to reduce bundle size and security surface');
}

if (summary.deadExportsCount > 0) {
  report.recommendations.push('🗑️ Remove unused exported functions/variables to clean up API surface');
}

if (summary.missingDependenciesCount > 0) {
  report.recommendations.push('⚠️ Add missing dependencies to package.json');
}

// Write the comprehensive report
fs.writeFileSync('reports/dead-code.json', JSON.stringify(report, null, 2));

// Generate markdown bullet points for the README
const bulletPoints = [
  `## Dead Code & Cleanup Analysis (${new Date().toLocaleDateString()})`,
  '',
  `### Summary`,
  `• **Total Issues Found**: ${summary.totalIssues}`,
  `• **Unused Imports**: ${summary.unusedImportsCount} occurrences`,
  `• **Unused Variables**: ${summary.unusedVariablesCount} occurrences`, 
  `• **Console Statements**: ${summary.consoleStatementsCount} occurrences`,
  `• **Dead Exports**: ${summary.deadExportsCount} unused exported symbols`,
  `• **Unused Dependencies**: ${summary.unusedDependenciesCount} packages`,
  `• **Missing Dependencies**: ${summary.missingDependenciesCount} packages`,
  '',
  '### Key Findings',
];

// Add top unused dependencies
if (deadCodeAnalysis.unusedDependencies.dependencies.length > 0) {
  bulletPoints.push('#### Unused Production Dependencies:');
  deadCodeAnalysis.unusedDependencies.dependencies.slice(0, 10).forEach(dep => {
    bulletPoints.push(`• \`${dep}\` - can be removed to reduce bundle size`);
  });
  bulletPoints.push('');
}

if (deadCodeAnalysis.unusedDependencies.devDependencies.length > 0) {
  bulletPoints.push('#### Unused Development Dependencies:');
  deadCodeAnalysis.unusedDependencies.devDependencies.slice(0, 10).forEach(dep => {
    bulletPoints.push(`• \`${dep}\` - can be removed from devDependencies`);
  });
  bulletPoints.push('');
}

// Add top files with most issues
const fileIssueCount = {};
[...deadCodeAnalysis.unusedImports, ...deadCodeAnalysis.unusedVariables, ...deadCodeAnalysis.consoleStatements]
  .forEach(issue => {
    fileIssueCount[issue.file] = (fileIssueCount[issue.file] || 0) + 1;
  });

const topFiles = Object.entries(fileIssueCount)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10);

if (topFiles.length > 0) {
  bulletPoints.push('#### Files with Most Issues:');
  topFiles.forEach(([file, count]) => {
    bulletPoints.push(`• \`${file}\` - ${count} issues (unused imports/variables, console statements)`);
  });
  bulletPoints.push('');
}

// Add most common dead exports
if (deadCodeAnalysis.deadExports.length > 0) {
  bulletPoints.push('#### Sample Dead Exports:');
  deadCodeAnalysis.deadExports.slice(0, 10).forEach(item => {
    bulletPoints.push(`• \`${item.symbol}\` in \`${item.file}\``);
  });
  bulletPoints.push('');
}

bulletPoints.push('### Recommendations');
report.recommendations.forEach(rec => {
  bulletPoints.push(`• ${rec}`);
});

bulletPoints.push('');
bulletPoints.push('### Cleanup Commands');
bulletPoints.push('```bash');
bulletPoints.push('# Remove unused imports automatically');
bulletPoints.push('npx eslint "src/**/*.{ts,tsx}" --fix');
bulletPoints.push('');
bulletPoints.push('# Remove unused dependencies');
if (deadCodeAnalysis.unusedDependencies.dependencies.length > 0) {
  bulletPoints.push(`npm uninstall ${deadCodeAnalysis.unusedDependencies.dependencies.slice(0, 5).join(' ')}`);
}
if (deadCodeAnalysis.unusedDependencies.devDependencies.length > 0) {
  bulletPoints.push(`npm uninstall --save-dev ${deadCodeAnalysis.unusedDependencies.devDependencies.slice(0, 5).join(' ')}`);
}
bulletPoints.push('```');

fs.writeFileSync('reports/dead-code-summary.md', bulletPoints.join('\n'));

// Console output
console.log('📊 Dead Code Analysis Complete!');
console.log('=====================================');
console.log(`Total Issues: ${summary.totalIssues}`);
console.log(`• Unused Imports: ${summary.unusedImportsCount}`);
console.log(`• Unused Variables: ${summary.unusedVariablesCount}`);
console.log(`• Console Statements: ${summary.consoleStatementsCount}`);
console.log(`• Dead Exports: ${summary.deadExportsCount}`);
console.log(`• Unused Dependencies: ${summary.unusedDependenciesCount}`);
console.log(`• Missing Dependencies: ${summary.missingDependenciesCount}`);
console.log('');
console.log('📄 Reports generated:');
console.log('• reports/dead-code.json - Detailed JSON report');
console.log('• reports/dead-code-summary.md - Ready-made bullet points');
console.log('');
console.log('🚀 Next steps:');
report.recommendations.forEach(rec => console.log(`  ${rec}`));
