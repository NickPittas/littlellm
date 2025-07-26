# Secure API Key Storage Implementation

This document outlines the implementation of secure API key storage in the LiteLLM application.

## Overview

The implementation separates API keys from general settings and stores them encrypted using Electron's `safeStorage` API. This enhances security while maintaining all existing functionality.

## Key Changes

### 1. New Secure API Key Service (`src/services/secureApiKeyService.ts`)

- **Encryption**: Uses Electron's `safeStorage.encryptString()` and `safeStorage.decryptString()`
- **Separate Storage**: API keys stored in `secure-api-keys.json` (encrypted)
- **Validation**: Provider-specific API key format validation
- **Migration**: Automatic migration from old plain-text settings
- **Listeners**: Event system for API key changes

### 2. Updated Settings Structure (`src/types/settings.ts`)

- **Removed API Keys**: `ProviderSettings` interface no longer includes `apiKey` field
- **Backward Compatibility**: `LegacyProviderSettings` interface for migration
- **Clean Structure**: Settings now only contain non-sensitive configuration

### 3. Enhanced Electron IPC (`electron/main.ts` & `electron/preload.ts`)

- **New Handlers**: `get-secure-api-keys` and `set-secure-api-keys`
- **Encryption Logic**: Handles encryption/decryption in main process
- **Fallback Support**: Works with plain text if encryption unavailable
- **Type Safety**: Updated TypeScript definitions

### 4. Updated UI Components

- **New Component**: `ApiKeySettings.tsx` for secure API key management
- **Integrated UI**: Replaces old API key inputs in `SettingsOverlay.tsx`
- **Real-time Validation**: Immediate feedback on API key format
- **Secure Display**: Password-type inputs with proper masking

### 5. Service Integration

- **Chat Service**: Updated to use secure API key service
- **Provider Support**: All LLM providers now use encrypted API keys
- **Seamless Migration**: Existing API keys automatically migrated

## Security Features

### Encryption
- Uses Electron's native `safeStorage` API
- Keys encrypted at rest
- Automatic fallback to plain text if encryption unavailable
- Separate storage from general settings

### Validation
- Provider-specific format validation
- Real-time feedback in UI
- Prevents invalid key storage

### Migration
- Automatic detection of old API keys
- Seamless migration to encrypted storage
- Cleanup of old plain-text keys
- No data loss during transition

## File Structure

```
src/
├── services/
│   ├── secureApiKeyService.ts     # New secure API key service
│   ├── settingsService.ts         # Updated (API keys removed)
│   └── chatService.ts             # Updated to use secure service
├── components/
│   ├── ApiKeySettings.tsx         # New API key management UI
│   └── SettingsOverlay.tsx        # Updated to use new component
├── types/
│   ├── settings.ts                # Updated interfaces
│   └── electron.d.ts              # Updated IPC types
└── test-secure-api-keys.ts        # Test utilities

electron/
├── main.ts                        # New IPC handlers
└── preload.ts                     # New API exposure
```

## Testing

### Manual Testing
1. **Start the application**
2. **Open Settings** → API Keys tab
3. **Add API keys** for different providers
4. **Verify encryption** by checking `secure-api-keys.json` (should be encrypted)
5. **Test migration** by adding old-format API keys to settings
6. **Verify functionality** by testing LLM provider connections

### Automated Testing
Run the test script:
```typescript
import { testSecureApiKeyService } from './src/test-secure-api-keys';
testSecureApiKeyService();
```

## Migration Process

### Automatic Migration
1. **Detection**: Service checks for existing API keys in settings
2. **Migration**: Moves API keys to encrypted storage
3. **Cleanup**: Removes API keys from old settings
4. **Verification**: Ensures no data loss

### Manual Migration
If needed, you can manually trigger migration:
```typescript
import { secureApiKeyService } from './src/services/secureApiKeyService';

// Migrate from old settings format
const oldProviders = {
  openai: { apiKey: 'sk-...', lastSelectedModel: 'gpt-4' },
  anthropic: { apiKey: 'sk-ant-...', lastSelectedModel: 'claude-3' }
};

await secureApiKeyService.migrateFromSettings(oldProviders);
```

## Troubleshooting

### Common Issues

1. **Encryption Not Available**
   - Fallback to plain text storage
   - Check Electron version and platform support

2. **Migration Issues**
   - Check console for migration logs
   - Verify old settings format
   - Manual migration may be needed

3. **API Key Not Found**
   - Ensure service is initialized
   - Check if migration completed
   - Verify provider ID matches

### Debug Logging
Enable debug logging to troubleshoot:
```typescript
// Check service status
console.log('Initialized:', secureApiKeyService.isInitialized());
console.log('Providers with keys:', secureApiKeyService.getProvidersWithApiKeys());

// Check specific provider
const data = secureApiKeyService.getApiKeyData('openai');
console.log('OpenAI data:', data);
```

## Benefits

1. **Enhanced Security**: API keys encrypted at rest
2. **Separation of Concerns**: API keys separate from settings
3. **Better Organization**: Cleaner settings structure
4. **Backward Compatibility**: Seamless migration
5. **Improved UX**: Better API key management interface
6. **Future-Proof**: Extensible for additional security features

## Future Enhancements

1. **Key Rotation**: Automatic API key rotation
2. **Multiple Keys**: Support for multiple keys per provider
3. **Key Sharing**: Secure key sharing between team members
4. **Audit Logging**: Track API key usage and changes
5. **Cloud Sync**: Encrypted cloud synchronization of keys
