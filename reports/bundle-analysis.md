# Bundle Analysis Report

Generated: 8/12/2025, 9:50:17 PM

## Summary

- **Performance Score**: 30/100
- **Total Size**: 5.02 MB
- **JavaScript**: 4.94 MB
- **CSS**: 83.07 KB
- **Files**: 103
- **Dependencies**: 38
- **Heavy Dependencies**: 6

## Largest JavaScript Files

| File | Size | Path |
|------|------|------|
| pdf.worker.min.js | 1007.63 KB | js\pdf.worker.min.js |
| page-45c70d8824b27e2e.js | 708.18 KB | _next\static\chunks\app\page-45c70d8824b27e2e.js |
| 2170a4aa.49ba600489c31f0d.js | 312.33 KB | _next\static\chunks\2170a4aa.49ba600489c31f0d.js |
| vendors-19a2b304-4d923fabe1c85503.js | 221.77 KB | _next\static\chunks\vendors-19a2b304-4d923fabe1c85503.js |
| document-processing.0c1d0534360aa342.js | 179.16 KB | _next\static\chunks\document-processing.0c1d0534360aa342.js |
| fd9d1056-351181798e076c0c.js | 168.79 KB | _next\static\chunks\fd9d1056-351181798e076c0c.js |
| framework-8e0e0f4a6b83a956.js | 136.72 KB | _next\static\chunks\framework-8e0e0f4a6b83a956.js |
| vendors-dfdbbe23-6c72e8880d5ab51d.js | 116.47 KB | _next\static\chunks\vendors-dfdbbe23-6c72e8880d5ab51d.js |
| polyfills-42372ed130431b0a.js | 109.96 KB | _next\static\chunks\polyfills-42372ed130431b0a.js |
| vendors-b49fab05-7c9d91c1a5caf57a.js | 97.12 KB | _next\static\chunks\vendors-b49fab05-7c9d91c1a5caf57a.js |

## Recommendations

### ⚠️ Large JavaScript files detected

**Category**: Bundle Size

Found 9 JavaScript files larger than 100KB

**Files**:
- pdf.worker.min.js (1007.63 KB)
- page-45c70d8824b27e2e.js (708.18 KB)
- 2170a4aa.49ba600489c31f0d.js (312.33 KB)
- vendors-19a2b304-4d923fabe1c85503.js (221.77 KB)
- document-processing.0c1d0534360aa342.js (179.16 KB)

**Suggestions**:
- Implement code splitting for large components
- Use dynamic imports for heavy libraries
- Consider lazy loading for non-critical features

### ℹ️ Heavy dependencies found

**Category**: Dependencies

Found 6 potentially heavy dependencies

**Files**:
- @xenova/transformers
- react-syntax-highlighter
- @radix-ui/react-icons
- framer-motion
- mammoth
- xlsx

**Suggestions**:
- Use dynamic imports for heavy libraries
- Consider lighter alternatives where possible
- Implement tree shaking for icon libraries

### 🚨 Total bundle size is very large

**Category**: Performance

Total JavaScript size: 4.94 MB

**Suggestions**:
- Implement aggressive code splitting
- Remove unused dependencies
- Use webpack-bundle-analyzer for detailed analysis

### ⚠️ Too many chunks detected

**Category**: Bundle Structure

Found 72 chunk files

**Suggestions**:
- Optimize webpack splitChunks configuration
- Merge small chunks to reduce HTTP requests
- Review chunk splitting strategy

