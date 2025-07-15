# LiteLLM Memory System

A persistent memory system for AI conversations that allows models to store and retrieve information across sessions.

## Overview

The memory system provides AI models with the ability to:
- Store important information for future reference
- Search through previous conversations and decisions
- Remember user preferences and settings
- Keep track of project-specific knowledge
- Store successful code snippets and solutions

## Architecture

### Components

1. **Memory Service** (`src/services/memoryService.ts`)
   - Core CRUD operations for memory entries
   - Search and indexing functionality
   - JSON-based storage management

2. **Memory Types** (`src/types/memory.ts`)
   - TypeScript interfaces and types
   - Memory entry structure definitions
   - Search query and response types

3. **MCP Tools** (`src/services/memoryMCPTools.ts`)
   - AI-accessible tools for memory operations
   - Integration with existing MCP system
   - Tool execution and validation

4. **Storage Layer** (Electron IPC)
   - File-based persistence in `%APPDATA%/littlellm/memory/`
   - Individual JSON files for each memory entry
   - Indexed metadata for efficient searching

### Storage Structure

```
%APPDATA%/littlellm/memory/
├── index.json              # Memory metadata index
├── entries/                # Individual memory entries
│   ├── mem_123456789_abc.json
│   ├── mem_123456790_def.json
│   └── ...
└── search-index.json       # Search optimization (future)
```

## Memory Types

- **user_preference**: User settings and preferences
- **conversation_context**: Important conversation history
- **project_knowledge**: Project-specific information
- **code_snippet**: Useful code examples and solutions
- **solution**: Successful problem solutions
- **general**: General-purpose memories

## MCP Tools

### memory-store
Store new information in persistent memory.

```json
{
  "type": "user_preference",
  "title": "Preferred AI Model",
  "content": "User prefers Claude 3.5 Sonnet for coding tasks",
  "tags": ["ai", "model", "preference"],
  "projectId": "optional-project-id",
  "conversationId": "optional-conversation-id"
}
```

### memory-search
Search through stored memories.

```json
{
  "text": "coding preferences",
  "type": "user_preference",
  "tags": ["ai", "model"],
  "limit": 10
}
```

### memory-retrieve
Get a specific memory by ID.

```json
{
  "id": "mem_123456789_abc"
}
```

### memory-update
Update an existing memory entry.

```json
{
  "id": "mem_123456789_abc",
  "title": "Updated Title",
  "content": "Updated content"
}
```

### memory-delete
Delete a memory entry.

```json
{
  "id": "mem_123456789_abc"
}
```

## Usage Examples

### For AI Models

AI models can use memory tools in their responses:

```
I'll remember your preference for dark theme.

**Tool: memory-store**
{
  "type": "user_preference",
  "title": "UI Theme Preference",
  "content": "User prefers dark theme for better readability",
  "tags": ["ui", "theme", "preference"]
}

I've stored this preference and will remember it for future conversations.
```

### For Developers

```typescript
import { memoryService } from './services/memoryService';

// Store a memory
const result = await memoryService.storeMemory({
  type: 'project_knowledge',
  title: 'API Endpoint',
  content: 'The user management API is at /api/users',
  tags: ['api', 'endpoint', 'users']
});

// Search memories
const searchResult = await memoryService.searchMemories({
  query: { text: 'API', limit: 5 }
});
```

## Integration with LiteLLM

The memory system integrates seamlessly with LiteLLM's existing architecture:

1. **MCP Integration**: Memory tools are automatically available to all AI models
2. **Provider Support**: Works with all supported AI providers (OpenAI, Anthropic, etc.)
3. **Storage Consistency**: Uses the same JSON-based storage pattern as conversations
4. **Performance**: Lightweight with lazy loading and efficient indexing

## Benefits

### For Users
- AI remembers preferences across sessions
- Consistent experience across conversations
- Personalized responses based on history
- Project-specific context retention

### For AI Models
- Access to relevant historical context
- Ability to learn from previous interactions
- Improved decision-making with stored knowledge
- Consistent behavior across sessions

### For Developers
- Easy to extend and customize
- Consistent with existing codebase patterns
- No external dependencies
- Simple backup and migration

## Future Enhancements

1. **Advanced Search**: Fuzzy search, semantic similarity
2. **Memory Analytics**: Usage statistics and insights
3. **Memory Cleanup**: Automatic archiving of old memories
4. **Export/Import**: Backup and restore functionality
5. **Memory Sharing**: Share memories between projects
6. **AI-Driven Organization**: Automatic tagging and categorization

## Testing

Run the memory system tests:

```bash
npm test src/tests/memorySystem.test.ts
```

## Configuration

Memory system settings can be configured in the LiteLLM settings:

- Maximum memory entries per project
- Automatic cleanup policies
- Search result limits
- Memory retention periods

## Security

- All memories are stored locally
- No external network access required
- File permissions follow Electron security model
- Content validation and sanitization

## Performance

- Lazy loading of memory entries
- Efficient metadata indexing
- Configurable result limits
- Background cleanup processes

The memory system provides a robust foundation for persistent AI memory while maintaining the simplicity and reliability of the LiteLLM architecture.
