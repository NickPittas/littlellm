# Security Configuration for LittleLLM

## Overview

This document outlines the security improvements implemented to address Content Security Policy (CSP) violations and Electron security warnings while maintaining functionality for local AI providers.

## Security Issues Addressed

### 1. Content Security Policy (CSP) Violations ✅

**Problem**: CSP was blocking connections to local AI providers (Ollama, LM Studio, etc.)
```
Refused to connect to 'http://localhost:11434/api/tags' because it violates the following Content Security Policy directive: "connect-src 'self' https: wss: ws:".
```

**Solution**: Updated CSP to allow local connections while maintaining security:
- Added `http://localhost:*`, `http://127.0.0.1:*`, `http://0.0.0.0:*` to `connect-src`
- Removed `upgrade-insecure-requests` to allow local HTTP connections
- Maintained strict policies for other directives

### 2. Electron Security Warnings ✅

**Problem**: Electron security warnings about insecure content and web security
```
Electron Security Warning (allowRunningInsecureContent)
Electron Security Warning (Insecure Content-Security-Policy)
```

**Solution**: Implemented secure Electron configuration:
- Enabled `webSecurity: true` (was previously disabled)
- Disabled `allowRunningInsecureContent: false`
- Added secure defaults: `experimentalFeatures: false`, `enableRemoteModule: false`

### 3. CSS MIME Type Issues ✅

**Problem**: CSS files being refused due to incorrect MIME type
```
Refused to apply style from '...' because its MIME type ('text/html') is not a supported stylesheet MIME type
```

**Solution**: Fixed through proper CSP configuration and Next.js optimization

## Security Architecture

### Secure Local Provider Proxy

Created a secure proxy system for local AI provider communication:

#### Components:
1. **Secure Proxy (`electron/secureLocalProxy.ts`)**
   - Validates allowed local provider URLs
   - Sanitizes headers and request data
   - Uses Electron's `net` module for secure requests
   - Implements security audit logging

2. **Secure Fetch Wrapper (`src/utils/secureLocalFetch.ts`)**
   - Provides fetch-like interface for renderer process
   - Routes local provider requests through secure proxy
   - Falls back to regular fetch for external requests
   - Includes comprehensive type definitions

3. **IPC Security Handlers**
   - `secure-local-request`: Proxied local provider requests
   - `check-local-provider-health`: Provider availability checks
   - `get-available-local-providers`: Provider discovery

### Allowed Local Providers

The secure proxy only allows connections to these verified local AI providers:

```typescript
const ALLOWED_LOCAL_PROVIDERS = {
  ollama: {
    host: 'localhost',
    port: 11434,
    protocol: 'http',
    paths: ['/api/tags', '/api/generate', '/api/chat', '/api/embeddings']
  },
  lmstudio: {
    host: '127.0.0.1',
    port: 1234,
    protocol: 'http',
    paths: ['/v1/models', '/v1/chat/completions', '/v1/completions']
  },
  llamacpp: {
    host: 'localhost',
    port: 8080,
    protocol: 'http',
    paths: ['/v1/models', '/v1/chat/completions', '/health']
  },
  janai: {
    host: 'localhost',
    port: 1337,
    protocol: 'http',
    paths: ['/v1/models', '/v1/chat/completions']
  }
};
```

## Implementation Details

### Content Security Policy (next.config.js)

```javascript
"Content-Security-Policy": [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' data:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:* http://0.0.0.0:*",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ')
```

### Electron Security Configuration

```typescript
webPreferences: {
  nodeIntegration: false,           // ✅ Secure
  contextIsolation: true,           // ✅ Secure
  webSecurity: true,                // ✅ Enabled (was disabled)
  allowRunningInsecureContent: false, // ✅ Disabled (was enabled)
  experimentalFeatures: false,      // ✅ Secure
  enableRemoteModule: false,        // ✅ Secure
  sandbox: false,                   // Required for preload script
  preload: path.join(__dirname, 'preload.js')
}
```

### Provider Updates

Updated local providers to use secure fetch:

**Ollama Provider**:
```typescript
// Before
const response = await fetch(`${ollamaUrl}/api/tags`, { ... });

// After
const response = await secureLocalFetch(`${ollamaUrl}/api/tags`, { ... });
```

**LM Studio Provider**:
```typescript
// Before
const response = await fetch(`${baseUrl}/models`, { ... });

// After
const response = await secureLocalFetch(`${baseUrl}/models`, { ... });
```

## Security Benefits

### 1. **Controlled Local Access**
- Only whitelisted local providers can be accessed
- Specific ports and paths are validated
- Unauthorized local requests are blocked

### 2. **Request Sanitization**
- Headers are sanitized to prevent injection attacks
- Request bodies are validated
- Response data is properly handled

### 3. **Audit Logging**
- All local provider requests are logged
- Security events are tracked
- Failed attempts are recorded

### 4. **Fallback Security**
- External requests still use regular fetch with CSP protection
- Non-Electron environments gracefully fall back
- Error handling prevents security bypasses

## Usage Examples

### Checking Provider Availability
```typescript
import { checkLocalProviderAvailability } from '../utils/secureLocalFetch';

const isOllamaAvailable = await checkLocalProviderAvailability('ollama');
```

### Making Secure Requests
```typescript
import { secureLocalFetch } from '../utils/secureLocalFetch';

const response = await secureLocalFetch('http://localhost:11434/api/tags', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
});
```

### Getting Available Providers
```typescript
import { getAvailableLocalProviders } from '../utils/secureLocalFetch';

const providers = await getAvailableLocalProviders();
console.log('Available providers:', providers);
```

## Security Monitoring

### Audit Logs
All local provider access is logged with:
- Timestamp
- Provider name
- Request URL and method
- Success/failure status
- Error details (if any)

### Example Log Output
```
[SECURITY_AUDIT] 2024-01-15T10:30:00.000Z - LOCAL_PROVIDER_REQUEST: {
  url: "http://localhost:11434/api/tags",
  method: "GET"
}
[SECURE_PROXY] Allowing ollama request to http://localhost:11434/api/tags
```

## Testing Security

### Verify CSP Compliance
1. Open browser developer tools
2. Check for CSP violation errors (should be none)
3. Verify local provider connections work

### Verify Electron Security
1. Check for Electron security warnings (should be none)
2. Verify `webSecurity` is enabled
3. Confirm `allowRunningInsecureContent` is disabled

### Test Provider Access
1. Start local providers (Ollama, LM Studio)
2. Verify they appear in available providers list
3. Test model loading and chat functionality
4. Check audit logs for proper request handling

## Future Enhancements

1. **Certificate Validation**: Add support for HTTPS local providers with custom certificates
2. **Rate Limiting**: Implement request rate limiting for local providers
3. **Streaming Support**: Add secure streaming support to the proxy
4. **Provider Authentication**: Support for provider-specific authentication methods
5. **Network Isolation**: Consider sandboxing local provider requests further

## Troubleshooting

### Common Issues

1. **Provider Not Available**: Check if the local AI provider is running and accessible
2. **CSP Violations**: Verify the CSP configuration includes local hosts
3. **Electron Warnings**: Ensure secure webPreferences are properly configured
4. **Type Errors**: Make sure electronAPI types are properly imported

### Debug Commands

```bash
# Check available providers
window.electronAPI.getAvailableLocalProviders()

# Test provider health
window.electronAPI.checkLocalProviderHealth('ollama')

# Make test request
window.electronAPI.secureLocalRequest({
  url: 'http://localhost:11434/api/tags',
  method: 'GET'
})
```
