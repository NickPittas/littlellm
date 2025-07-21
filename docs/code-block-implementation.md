# Code Block Detection and Copy-Paste Implementation

## Overview

This document describes the implementation of code block detection and copy-paste functionality in the LiteLLM chat interface.

## Features Implemented

### 1. Code Block Detection
- Detects markdown-style code blocks with triple backticks (```)
- Supports optional language specification (```javascript, ```python, etc.)
- Handles code blocks without language specification
- Preserves code formatting and whitespace

### 2. Inline Code Detection
- Detects inline code with single backticks (`code`)
- Styled differently from code blocks for better readability
- Maintains text flow within paragraphs

### 3. Copy-Paste Functionality
- Copy button for each code block with hover visibility
- One-click copying to clipboard
- Visual feedback (checkmark) when copy succeeds
- Fallback copy method for older browsers
- Preserves exact code formatting when copied

### 4. Smart Content Parsing
- **Priority-based parsing**: Code blocks → Inline code → Links → Text
- **Context-aware**: URLs inside code blocks/inline code are NOT made clickable
- **Comprehensive**: Handles mixed content (code + links + text) correctly

## Implementation Details

### Files Created/Modified

1. **`src/components/CodeBlock.tsx`** - New components for code rendering
2. **`src/lib/contentParser.tsx`** - Comprehensive content parser
3. **`src/components/UserMessage.tsx`** - Updated to use new parser
4. **`src/components/MessageWithThinking.tsx`** - Updated to use new parser

### Core Components

#### CodeBlock Component (`src/components/CodeBlock.tsx`)

**Features:**
- Header showing language name and copy button
- Syntax-highlighted code content area
- Responsive design with horizontal scrolling
- Copy functionality with visual feedback

**Props:**
```typescript
interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}
```

#### InlineCode Component

**Features:**
- Subtle background styling
- Monospace font
- Inline text flow
- Text selection enabled

### Content Parser (`src/lib/contentParser.tsx`)

#### Parsing Strategy

**1. Priority Order:**
```
Code Blocks (```) → Inline Code (`) → Full URLs → Domain URLs → Text
```

**2. Regex Patterns:**
```javascript
// Code blocks with optional language
const CODE_BLOCK_REGEX = /```(\w+)?\n?([\s\S]*?)```/g;

// Inline code (single backticks)
const INLINE_CODE_REGEX = /`([^`\n]+)`/g;

// Full URLs (from link parser)
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

// Domain-only URLs (from link parser)
const DOMAIN_REGEX = /(^|[\s\(\[\{])((?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.(?:[a-zA-Z]{2,6}|localhost)(?::\d+)?(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?)/g;
```

**3. Conflict Resolution:**
- URLs inside code blocks are ignored
- URLs inside inline code are ignored
- Domain URLs don't override full URLs
- Overlapping segments are handled by priority

#### Content Segment Structure

```typescript
interface ContentSegment {
  type: 'text' | 'link' | 'code-block' | 'inline-code';
  content: string;
  url?: string;        // For links
  language?: string;   // For code blocks
  index: number;       // Position in original text
  length: number;      // Length of matched content
}
```

## Usage Examples

### Basic Code Block
```
Input: "Here's a function:\n```javascript\nfunction hello() {\n  return 'world';\n}\n```"
Output: Renders as a styled code block with JavaScript syntax highlighting and copy button
```

### Inline Code
```
Input: "Use the `npm install` command to install packages"
Output: "Use the [npm install] command to install packages" (where [code] is styled)
```

### Mixed Content
```
Input: "Check this code: `const url = 'https://example.com'` and visit github.com"
Output: 
- Inline code: "const url = 'https://example.com'" (URL not clickable)
- Clickable link: "github.com" → opens https://github.com
```

### Code Block with URLs
```
Input: "```bash\ncurl https://api.github.com\nwget example.com/file.zip\n```"
Output: Code block with URLs inside NOT made clickable (correct behavior)
```

## Visual Design

### Code Block Styling
- **Header**: Light background with language name and copy button
- **Content**: Darker background, monospace font, horizontal scroll
- **Copy Button**: Hidden by default, appears on hover
- **Feedback**: Green checkmark when copy succeeds

### Inline Code Styling
- **Background**: Subtle muted background
- **Font**: Monospace font family
- **Padding**: Small padding for readability
- **Border**: Rounded corners

## Integration with Existing Features

### Link Parser Integration
- Code blocks and inline code take priority over link detection
- Links outside code are still fully functional
- Domain-only URLs work alongside code detection

### Message Components
- **UserMessage**: Supports code blocks in user messages
- **MessageWithThinking**: Supports code in AI responses, thinking sections, and tool results
- **Tool Results**: Code in tool execution results is properly formatted

## Browser Compatibility

- **Modern Browsers**: Full functionality with Clipboard API
- **Older Browsers**: Fallback copy method using document.execCommand
- **Mobile**: Touch-friendly copy buttons and responsive design

## Performance Considerations

- **Regex Efficiency**: Optimized patterns with proper lastIndex reset
- **React Rendering**: Minimal re-renders, efficient key generation
- **Memory Usage**: No memory leaks, proper cleanup

## Security

- **XSS Prevention**: All code content is properly escaped
- **No Code Execution**: Code is displayed only, never executed
- **Safe Copying**: Only text content is copied, no HTML or scripts

## Future Enhancements

Potential improvements:
1. **Syntax Highlighting**: Add a lightweight syntax highlighter
2. **Language Detection**: Auto-detect language for unlabeled code blocks
3. **Line Numbers**: Optional line numbering for code blocks
4. **Code Folding**: Collapse/expand large code blocks
5. **Download Code**: Save code blocks as files
6. **Multiple Copy Formats**: Copy as plain text, HTML, or markdown

## Testing

The implementation has been tested with:
- Various programming languages (JavaScript, Python, Bash, etc.)
- Code blocks with and without language specification
- Mixed content (code + links + text)
- Inline code with URLs inside
- Edge cases (empty code blocks, special characters)
- Copy functionality across different browsers

## Troubleshooting

### Common Issues

1. **Code not detected**: Ensure proper markdown formatting with triple backticks
2. **Copy not working**: Check browser permissions for clipboard access
3. **Styling issues**: Verify Tailwind CSS classes are available
4. **Links in code clickable**: This is prevented by design - working correctly

### Debug Information

The implementation includes:
- Console logging for copy operations
- Error handling for clipboard failures
- Fallback mechanisms for older browsers
