# Compilation Errors

## Summary
- **Total Errors**: 10
- **Files with Errors**: 4
- **Compilation Status**: ❌ Failed

## Error Categories
- **Missing Property**: 7 errors
- **Missing Required Property**: 2 errors  
- **Variable Name**: 1 error

## Files Requiring Fixes

### 🔴 High Priority: `src/components/MessageWithThinking.tsx`
**7 errors** - Missing properties on tool objects
- Lines: 694, 699, 703, 708, 719, 776, 777
- **Issue**: Tool objects missing `error` and `result` properties
- **Fix**: Define proper interface for tool objects with optional `error?: string` and `result?: unknown` properties

### 🟡 Medium Priority: `src/services/providers/AnthropicProvider.ts`
**1 error** - Variable name issue
- Line: 1051
- **Issue**: Using undefined variable `settings` instead of `_settings`
- **Fix**: Replace `settings` with `_settings`

### 🟡 Medium Priority: `src/services/settingsService.ts`
**1 error** - Missing required property
- Line: 324
- **Issue**: `ProvidersConfig` missing required `jan` property
- **Fix**: Add `jan` property to ProvidersConfig type and default configuration

### 🟢 Low Priority: `src/tests/settingsReloadBehavior.test.ts`
**1 error** - Test configuration incomplete
- Line: 93
- **Issue**: Test object missing required `jan` property
- **Fix**: Add `jan` property to test configuration object

## Recommended Action Plan

1. **Start with MessageWithThinking.tsx**: Define a proper `ToolCall` interface
2. **Fix AnthropicProvider.ts**: Simple variable name correction
3. **Update settingsService.ts**: Add missing configuration property
4. **Update test file**: Align test data with updated types

## Generated Files
- `reports/ts-errors.log` - Raw TypeScript compiler output
- `reports/ts-errors-structured.json` - Structured error data
- `reports/ts-errors.csv` - Spreadsheet-friendly format
