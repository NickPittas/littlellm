# Mistral File Upload and Document AI Integration

This document explains how to use the new Mistral file upload and document processing capabilities in LittleLLM.

## Overview

LittleLLM now supports Mistral's native file upload and Document AI capabilities, including:

- **File Upload API**: Upload files up to 512MB to Mistral's servers
- **Document AI**: OCR and document processing for PDFs and images
- **Vision Models**: Direct PDF and image analysis with vision-capable models
- **Structured Output**: Extract structured data from documents

## Supported File Types

### For Mistral Provider

When using Mistral as your provider, the following file types are supported:

#### Images (Vision Models)
- PNG (.png)
- JPEG (.jpg, .jpeg)
- WebP (.webp)
- GIF (.gif) - non-animated only

#### Documents (Document AI/OCR)
- PDF (.pdf)
- Text files (.txt, .md, .log)
- CSV files (.csv)
- JSON files (.json)

#### File Size Limits
- Maximum file size: **512 MB**
- Maximum images per request: **8**
- Maximum image resolution: varies by model (up to 1540x1540)

## How It Works

### 1. File Upload Process

When you upload a file with Mistral selected as your provider:

1. **Validation**: Files are validated against Mistral's supported formats and size limits
2. **Processing**: Files are processed using the appropriate Mistral service:
   - Images → Vision models (direct base64 encoding)
   - PDFs → Vision models or Document AI (depending on content)
   - Text files → OCR processing (if needed) or direct text extraction
3. **Integration**: Processed content is included in your chat message

### 2. Provider-Specific Processing

#### Mistral Vision Models
- **Pixtral 12B** (`pixtral-12b-latest`)
- **Pixtral Large** (`pixtral-large-latest`)
- **Mistral Medium** (`mistral-medium-latest`)
- **Mistral Small** (`mistral-small-latest`)

These models can directly analyze:
- Images (all supported formats)
- PDFs (treated as images for vision analysis)

#### Mistral Document AI
For text extraction and OCR:
- Uses `/v1/ocr` endpoint
- Supports multilingual documents
- Provides structured output capabilities
- Handles complex document layouts

### 3. UI Feedback

The file upload interface provides provider-specific feedback:

- **📄 Mistral Document AI**: For PDF files
- **🖼️ Mistral Vision**: For image files  
- **🔍 Mistral OCR**: For text documents requiring OCR

## Usage Examples

### Basic File Upload

1. Select **Mistral** as your provider
2. Choose a vision-capable model (e.g., `pixtral-12b-latest`)
3. Click the file upload button
4. Select your PDF, image, or document files
5. Type your message or question about the files
6. Send the message

### PDF Analysis

```
Upload a PDF and ask:
"Please summarize the key points in this document"
"Extract all the dates and names mentioned"
"What is the main topic of this research paper?"
```

### Image Analysis

```
Upload an image and ask:
"What do you see in this image?"
"Extract the text from this screenshot"
"Analyze the chart and provide insights"
```

### Document Processing

```
Upload a text document and ask:
"Convert this document to structured JSON"
"Extract contact information from this document"
"Summarize the main sections"
```

## Technical Implementation

### File Service (`MistralFileService`)

The `MistralFileService` class handles:
- File uploads to Mistral's `/v1/files` endpoint
- OCR processing via `/v1/ocr` endpoint
- File validation and size checking
- Base64 encoding for vision models

### Provider Integration (`MistralProvider`)

The `MistralProvider` class:
- Automatically detects file types and routes to appropriate processing
- Handles vision model compatibility checking
- Integrates with MCP tools and streaming responses
- Provides fallback error handling

### Chat Service Integration

The chat service:
- Routes Mistral files to native processing
- Falls back to generic processing if needed
- Maintains compatibility with other providers

## Error Handling

Common errors and solutions:

### File Too Large
```
Error: File size 600MB exceeds Mistral's 512MB limit
Solution: Compress or split the file
```

### Unsupported File Type
```
Error: File type application/zip not supported
Solution: Use supported formats (PDF, PNG, JPG, TXT, etc.)
```

### Model Doesn't Support Vision
```
Error: Mistral model "mistral-tiny" does not support images
Solution: Switch to a vision-capable model like "pixtral-12b-latest"
```

### API Key Issues
```
Error: Mistral file service not initialized - API key required
Solution: Configure your Mistral API key in Settings
```

## Best Practices

1. **Choose the Right Model**: Use vision models for images/PDFs, text models for pure text
2. **Optimize File Size**: Compress large files when possible
3. **Clear Instructions**: Be specific about what you want extracted or analyzed
4. **Batch Processing**: Upload multiple related files together for context
5. **Structured Queries**: Use structured output format for data extraction

## Troubleshooting

### Files Not Processing
1. Check your Mistral API key is configured
2. Verify the file type is supported
3. Ensure file size is under 512MB
4. Try a different vision-capable model

### Poor OCR Results
1. Ensure document image quality is good
2. Try uploading as an image instead of PDF
3. Use higher resolution scans
4. Check document language is supported

### Vision Model Errors
1. Verify model supports vision (check model name)
2. Reduce image resolution if too large
3. Try converting PDF to images first
4. Check API quota and limits

## API Reference

For advanced usage, see the Mistral API documentation:
- [File Upload API](https://docs.mistral.ai/api/#tag/files)
- [Document AI](https://docs.mistral.ai/capabilities/OCR/document_ai_overview/)
- [Vision Capabilities](https://docs.mistral.ai/capabilities/vision/)
