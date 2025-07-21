# HTTP Link Parsing Implementation

## Overview

This document describes the implementation of HTTP link parsing and clickable links in the LiteLLM chat interface.

## Features Implemented

### 1. Enhanced Link Detection
- Detects HTTP and HTTPS URLs in chat messages
- **NEW**: Detects domain-only URLs (e.g., `weather.com`, `github.com`) and automatically adds `https://`
- Supports URLs with or without www
- Handles complex URLs with paths, query parameters, and fragments
- Supports URLs with ports (e.g., localhost:3000)
- Handles URLs in various contexts (parentheses, brackets, punctuation)
- Intelligent trailing punctuation removal

### 2. Clickable Links
- Renders detected URLs as clickable links
- Opens links in the user's default browser (via Electron's shell.openExternal)
- Preserves text formatting and whitespace
- Maintains existing text selection and copy functionality

### 3. Visual Styling
- Links are styled with blue color and underline
- Hover effects for better user experience
- Consistent with the application's design system

## Implementation Details

### Files Modified/Created

1. **`src/lib/linkParser.tsx`** - New utility for link parsing and rendering
2. **`src/components/UserMessage.tsx`** - Updated to use link parsing
3. **`src/components/MessageWithThinking.tsx`** - Updated to use link parsing
4. **`electron/main.ts`** - Added IPC handler for opening external links
5. **`electron/preload.ts`** - Added API exposure for external link opening
6. **`src/types/electron.d.ts`** - Added type definition for openExternalLink

### Core Components

#### LinkParser Utility (`src/lib/linkParser.tsx`)

**Key Functions:**
- `parseTextSegments(text: string)` - Parses text into segments of regular text and URLs
- `ParsedTextWithLinks` - React component that renders text with clickable links
- `parseTextWithLinks(text, className, style)` - Utility function for easy integration

**URL Regex Patterns:**

*Full URLs (with protocol):*
```javascript
/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
```

*Domain-only URLs (without protocol):*
```javascript
/(^|[\s\(\[\{])((?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.(?:[a-zA-Z]{2,6}|localhost)(?::\d+)?(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?)/g
```

#### Electron Integration

**Main Process (`electron/main.ts`):**
```javascript
ipcMain.handle('open-external-link', async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Preload Script (`electron/preload.ts`):**
```javascript
openExternalLink: (url: string) => ipcRenderer.invoke('open-external-link', url)
```

### Integration Points

#### UserMessage Component
- Replaced direct text rendering with `parseTextWithLinks(content)`
- Maintains all existing styling and functionality

#### MessageWithThinking Component
- Updated main response content rendering
- Updated thinking section text rendering
- Updated tool execution result rendering
- Preserves all existing parsing and display logic

## Usage Examples

### Basic URL Detection
```
Input: "Visit https://example.com for more info"
Output: "Visit [https://example.com] for more info" (where [link] is clickable)
```

### Domain-Only URLs (NEW!)
```
Input: "Check weather.com and wunderground.com for forecasts"
Output: "Check [weather.com] and [wunderground.com] for forecasts"
Note: Links open as https://weather.com and https://wunderground.com
```

### URLs in Context
```
Input: "The Weather Channel (weather.com) and AccuWeather"
Output: "The Weather Channel ([weather.com]) and AccuWeather"
```

### Multiple URLs
```
Input: "Check https://google.com and github.com"
Output: "Check [https://google.com] and [github.com]"
```

### Complex URLs
```
Input: "API: https://api.example.com/v1/users?id=123&format=json#section"
Output: "API: [https://api.example.com/v1/users?id=123&format=json#section]"
```

## Security Considerations

1. **URL Validation**: The regex pattern is designed to match valid HTTP/HTTPS URLs only
2. **External Opening**: Links are opened via Electron's shell.openExternal, which is the secure way to open external URLs
3. **No JavaScript Execution**: Links don't execute JavaScript or navigate within the app
4. **User Control**: Users can see the full URL before clicking (via tooltip)

## Browser Compatibility

- **Electron Environment**: Full functionality with external browser opening
- **Web Environment**: Fallback logging (could be extended to use window.open)
- **Development**: Works in Next.js development environment

## Performance

- **Regex Performance**: Efficient regex pattern with proper lastIndex reset
- **React Rendering**: Minimal re-renders, only when content changes
- **Memory Usage**: No memory leaks, proper cleanup of event handlers

## Testing

The implementation has been tested with:
- Various URL formats (HTTP, HTTPS, with/without www)
- URLs with ports, paths, query parameters, and fragments
- Multiple URLs in single messages
- Edge cases (URLs at beginning/end of text, empty text)
- Integration with existing message components

## Future Enhancements

Potential improvements that could be added:
1. **Link Preview**: Show URL previews on hover
2. **Custom Protocols**: Support for other protocols (mailto:, tel:, etc.)
3. **Link Validation**: Real-time validation of link accessibility
4. **User Preferences**: Allow users to disable link parsing
5. **Link Analytics**: Track which links are clicked for usage insights

## Troubleshooting

### Common Issues

1. **Links not clickable**: Ensure Electron APIs are properly loaded
2. **Styling issues**: Check CSS specificity and Tailwind classes
3. **External browser not opening**: Verify shell.openExternal permissions

### Debug Information

The implementation includes console logging for:
- External URL opening attempts
- Error handling for failed link opens
- Development environment fallbacks
