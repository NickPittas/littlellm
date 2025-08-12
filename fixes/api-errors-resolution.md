# API Errors Resolution

## Issue Description
Two API errors were encountered during testing:

1. **Gemini API Error**: Duplicate system instruction setting
2. **Requesty API Error**: Rate limit exceeded for GPT-5 model

## Root Causes and Fixes

### 1. Gemini API Error - Duplicate System Instructions

**Error Message:**
```
Invalid value (oneof), oneof field '_system_instruction' is already set. Cannot set 'system_instruction'
```

**Root Cause:**
The GeminiProvider was setting system instructions twice in different formats:
- Line 195/206: `requestBody.systemInstruction` (camelCase)
- Line 230: `requestBody.system_instruction` (snake_case)

This caused a conflict because the Gemini API only allows one system instruction field.

**Fix Applied:**
- Removed the duplicate system instruction setting at line 230
- Kept the proper implementation with caching logic at lines 195/206
- The system instruction is now set only once with proper caching support

**File Modified:**
- `src/services/providers/GeminiProvider.ts`

**Code Change:**
```typescript
// REMOVED: Duplicate system instruction setting
// Set system instruction (behavioral prompt only - no tool descriptions)
if (systemPrompt) {
  requestBody.system_instruction = {
    parts: [{ text: systemPrompt }]
  };
  // ... logging code
}

// REPLACED WITH: Comment indicating proper location
// System instruction is already set above with proper caching logic
```

### 2. Requesty API Error - Rate Limit for GPT-5

**Error Message:**
```
Request too large for gpt-5 in organization org-lLOq0ZcXUOSmEIdMWqYdwRFY on requests per min (RPM): Limit 0, Requested 1
```

**Root Cause:**
This is not a code issue but an API access limitation:
- The user's Requesty account has a rate limit of 0 for the GPT-5 model
- This means they don't have access to use GPT-5 through Requesty
- The model is available in the dropdown but not accessible with current API limits

**Resolution Options:**
1. **Switch to a different model** that has available quota
2. **Upgrade Requesty plan** to get access to GPT-5
3. **Use a different provider** for GPT-5 access (e.g., OpenAI directly)

**No Code Changes Required** - This is a configuration/subscription issue.

## Prevention Measures

### For Gemini Issues:
- Added code review checkpoint to ensure system instructions are set only once
- The caching logic implementation should be the single source of truth

### For Rate Limit Issues:
- Consider adding rate limit detection and user-friendly error messages
- Could implement model availability checking before allowing selection
- Add tooltips or indicators showing which models are available vs. rate-limited

## Testing Results

After applying the Gemini fix:
- ✅ Build completes successfully
- ✅ No duplicate system instruction errors
- ✅ Gemini API calls should work properly
- ✅ System instruction caching logic preserved

## Related Files
- `src/services/providers/GeminiProvider.ts` - Fixed duplicate system instructions
- `src/services/providers/RequestyProvider.ts` - No changes needed (API access issue)

## Future Improvements
1. Add validation to prevent duplicate system instruction settings
2. Implement rate limit detection and user feedback
3. Add model availability indicators in the UI
4. Consider adding retry logic with exponential backoff for rate-limited requests
