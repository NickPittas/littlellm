# Document Parsing System

The LiteLLM application now supports comprehensive document parsing for a wide variety of file formats. This system automatically extracts text content from documents and provides it to AI models for analysis.

## Supported File Formats

### Native Support (Provider-Dependent)
These formats may be processed natively by certain AI providers:

- **PDF** - Portable Document Format
- **TXT** - Plain text files
- **MD** - Markdown files

### Parsed Formats
These formats are processed using the DocumentParserService:

- **DOCX/DOC** - Microsoft Word documents
- **XLSX/XLS** - Microsoft Excel spreadsheets
- **ODS** - OpenDocument Spreadsheets
- **PPTX/PPT** - Microsoft PowerPoint presentations
- **CSV** - Comma-separated values
- **JSON** - JavaScript Object Notation
- **HTML/HTM** - HyperText Markup Language
- **XML** - eXtensible Markup Language
- **ICS** - iCalendar files
- **RTF** - Rich Text Format

## Provider Capabilities

Different AI providers have varying levels of native document support:

### Mistral AI
- **Native Support**: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, TXT, MD, CSV, JSON
- **Requires Parsing**: ODS, HTML, HTM, XML, ICS, RTF

### Anthropic
- **Native Support**: PDF, TXT, MD, CSV
- **Requires Parsing**: DOCX, DOC, XLSX, XLS, ODS, PPTX, PPT, JSON, HTML, HTM, XML, ICS, RTF

### OpenAI
- **Native Support**: PDF, TXT, MD (via Assistants API)
- **Requires Parsing**: DOCX, DOC, XLSX, XLS, ODS, PPTX, PPT, CSV, JSON, HTML, HTM, XML, ICS, RTF

### Other Providers
- **Native Support**: TXT, MD (basic text support)
- **Requires Parsing**: All other formats

## Usage Examples

### Basic File Upload
```typescript
// Files are automatically processed when uploaded
const files = [wordDoc, excelSheet, csvFile];
const response = await chatService.sendMessage(
  "Analyze these documents",
  files,
  settings
);
```

### Document Processing Results

#### Word Document (.docx)
```
[Word Document: report.docx]
✅ Parsing Status: Success
Processing Time: 150ms
Title: Annual Report 2024

Content:
Executive Summary
This report provides an overview of our company's performance...
```

#### Excel Spreadsheet (.xlsx)
```
[Spreadsheet: data.xlsx]
✅ Parsing Status: Success
Processing Time: 200ms
Sheets: Sales, Inventory, Summary

Content:
=== Sheet: Sales ===
Date,Product,Amount
2024-01-01,Widget A,1000
2024-01-02,Widget B,1500

=== Sheet: Inventory ===
Product,Stock,Location
Widget A,50,Warehouse 1
Widget B,75,Warehouse 2
```

#### CSV File (.csv)
```
[CSV: customers.csv]
✅ Parsing Status: Success
Processing Time: 50ms

Content:
Headers: name, email, city

Row 1:
  name: John Doe
  email: john@example.com
  city: New York

Row 2:
  name: Jane Smith
  email: jane@example.com
  city: Los Angeles
```

#### JSON File (.json)
```
[JSON: config.json]
✅ Parsing Status: Success
Processing Time: 25ms

Content:
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp"
  },
  "features": {
    "authentication": true,
    "logging": true
  }
}
```

#### HTML File (.html)
```
[HTML: webpage.html]
✅ Parsing Status: Success
Processing Time: 75ms
Title: Welcome Page

Content:
Welcome to Our Website
This is the main content of the page.
Contact us for more information.
```

#### Calendar File (.ics)
```
[Calendar (ICS): events.ics]
✅ Parsing Status: Success
Processing Time: 100ms

Content:
Calendar Events:

Event 1:
  Title: Team Meeting
  Start: Mon Jan 15 2024 09:00:00
  End: Mon Jan 15 2024 10:00:00
  Description: Weekly team sync
  Location: Conference Room A

Event 2:
  Title: Project Deadline
  Start: Fri Jan 19 2024 17:00:00
  End: Fri Jan 19 2024 17:00:00
```

### Error Handling and Fallbacks

#### Parsing Failure with Fallback
```
[Fallback: corrupted.docx]
⚠️ Parsing Status: Failed (using fallback)
Error: Invalid document structure
Processing Time: 100ms

Content:
[Document: corrupted.docx]
File Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
File Size: 45KB
Extension: .docx

Error: Invalid document structure

Note: Document parsing failed. Please describe the content you'd like me to analyze, or try converting the document to a supported format (PDF, TXT, etc.).
```

## Statistics and Monitoring

The system tracks parsing performance and success rates:

```typescript
// Get parsing statistics
const stats = chatService.getDocumentParsingStats();
console.log(stats);
// Output:
// {
//   totalAttempts: 150,
//   successfulParses: 142,
//   failedParses: 8,
//   fallbacksUsed: 5,
//   averageProcessingTime: 185.5,
//   errorsByType: {
//     'format': 3,
//     'memory': 2,
//     'network': 1,
//     'parsing': 2
//   }
// }

// Reset statistics
chatService.resetDocumentParsingStats();
```

## Error Categories

The system categorizes parsing errors for better monitoring:

- **format**: Invalid or corrupted file format
- **memory**: File too large or memory issues
- **network**: Network-related errors during processing
- **permission**: File access permission issues
- **timeout**: Processing timeout
- **parsing**: General parsing errors
- **unknown**: Unclassified errors

## File Size Limits

- **General documents**: 512MB maximum
- **OCR processing**: 50MB maximum (provider-dependent)
- **Memory considerations**: Large files may require more processing time

## Best Practices

1. **File Format Selection**: Use native formats when possible for better performance
2. **File Size**: Keep files under 50MB for optimal processing speed
3. **Error Handling**: Always check parsing status in responses
4. **Fallback Content**: Provide context when parsing fails
5. **Statistics Monitoring**: Regularly check parsing statistics for system health

## Integration with UI Components

The AttachmentPreview component shows visual indicators for file processing:

- 🟢 **Native**: File will be processed natively by the AI provider
- 🔵 **Parsed**: File will be processed using document parsing
- 🔴 **Unsupported**: File type is not supported

## Technical Implementation

The document parsing system consists of:

1. **DocumentParserService**: Core parsing logic
2. **Provider Capabilities**: Configuration for each AI provider
3. **Error Handling**: Comprehensive fallback mechanisms
4. **Statistics Tracking**: Performance monitoring
5. **UI Integration**: Visual indicators and file type support

For technical details, see the source code in:
- `src/services/DocumentParserService.ts`
- `src/services/providers/constants.ts`
- `src/components/AttachmentPreview.tsx`
