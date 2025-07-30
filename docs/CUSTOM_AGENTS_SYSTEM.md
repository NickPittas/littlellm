# Custom Agent Creation System

## Overview

The Custom Agent Creation System allows users to create specialized AI agents with specific tool access and predefined prompts for targeted tasks. This system provides a comprehensive interface for creating, managing, and using custom agents within LittleLLM.

## Features

### Agent Creation
- **Template-based Creation**: Start with predefined templates or create from scratch
- **Tool Selection**: Choose from available internal tools and MCP servers
- **AI-Generated Prompts**: Use LLMs to generate specialized system prompts
- **Provider Configuration**: Set default LLM provider and model for each agent
- **Custom Settings**: Configure temperature, max tokens, and other parameters

### Agent Management
- **Visual Interface**: Grid-based agent management with cards showing agent details
- **Search and Filter**: Find agents by name, description, or tags
- **Import/Export**: Share agents via JSON files
- **Duplicate Agents**: Clone existing agents for modification
- **Validation**: Check agent configuration for missing dependencies

### Agent Integration
- **Chat Interface**: Select agents from dropdown in chat interface
- **Automatic Configuration**: Agents automatically configure LLM settings and tools
- **Runtime Switching**: Change agents mid-conversation
- **Tool Access**: Agents have access only to their configured tools

## Architecture

### Core Components

1. **Agent Service** (`src/services/agentService.ts`)
   - CRUD operations for agents
   - Prompt generation using LLMs
   - Import/export functionality
   - Validation and dependency checking

2. **Agent Types** (`src/types/agent.ts`)
   - TypeScript interfaces for all agent-related data
   - Default agent templates
   - Configuration structures

3. **UI Components**
   - `AgentManagement.tsx`: Main management interface
   - `CreateAgentDialog.tsx`: Multi-step agent creation wizard
   - `EditAgentDialog.tsx`: Agent editing interface
   - Agent dropdown in `BottomInputArea.tsx`

### Data Storage

Agents are stored in JSON format in the user data directory:
- File: `agents.json`
- Location: `app.getPath('userData')/state/agents.json`
- Format: Includes agents array, templates, version, and metadata

### Integration Points

1. **LLM Service**: For prompt generation and chat functionality
2. **MCP Service**: For tool discovery and server management
3. **Settings Service**: For provider and model configuration
4. **Chat Interface**: For agent selection and runtime configuration

## Usage Guide

### Creating an Agent

1. **Access Agent Management**
   - Click the Custom Agents button (🤖) in the left sidebar
   - Click "Create Agent" button

2. **Choose Template**
   - Select from predefined templates or "Custom Agent"
   - Templates include: Document Analyst, Web Researcher, Code Assistant, etc.

3. **Configure Basic Info**
   - Set agent name and description
   - Choose an icon (emoji)
   - Describe the agent's purpose in detail
   - Select default provider and model

4. **Select Tools**
   - Choose from available internal tools
   - Enable relevant MCP servers
   - Tools are categorized (file, web, system, etc.)

5. **Generate Prompt**
   - AI generates a specialized system prompt based on configuration
   - Review and edit the generated prompt
   - Prompt can be regenerated or manually edited

6. **Review and Create**
   - Review all settings
   - Create the agent

### Using an Agent

1. **Select Agent**
   - Use the agent dropdown in the chat interface
   - Agent automatically configures LLM settings and tools

2. **Chat with Agent**
   - Agent uses its specialized prompt and tool access
   - Maintains agent configuration throughout conversation

3. **Switch Agents**
   - Change agents mid-conversation
   - New agent configuration applies immediately

### Managing Agents

1. **Edit Agents**
   - Click edit button on agent card
   - Modify configuration, tools, or prompt
   - Regenerate prompt if needed

2. **Export/Import**
   - Export agents as JSON files for sharing
   - Import agents from JSON files
   - Validation checks for missing dependencies

3. **Duplicate Agents**
   - Clone existing agents for modification
   - Useful for creating variations

## Agent Templates

### Built-in Templates

1. **Document Analyst** 📄
   - Purpose: Document analysis and summarization
   - Tools: File operations, PDF parsing, knowledge base
   - Provider: Anthropic Claude

2. **Web Researcher** 🌐
   - Purpose: Web browsing and information gathering
   - Tools: Web search, URL fetching, browser automation
   - Provider: OpenAI GPT-4

3. **Code Assistant** 💻
   - Purpose: Software development and code review
   - Tools: File operations, code execution, Git operations
   - Provider: Anthropic Claude

4. **Data Analyst** 📊
   - Purpose: Data analysis and visualization
   - Tools: CSV parsing, statistical analysis, visualization
   - Provider: OpenAI GPT-4

5. **Creative Writer** ✍️
   - Purpose: Creative writing and content creation
   - Tools: File operations, web search, memory
   - Provider: Anthropic Claude

6. **Business Analyst** 📈
   - Purpose: Business analysis and market research
   - Tools: Web search, data visualization, memory
   - Provider: OpenAI GPT-4

7. **Technical Writer** 📝
   - Purpose: Technical documentation creation
   - Tools: File operations, web search, code execution
   - Provider: Anthropic Claude

8. **Customer Support** 🎧
   - Purpose: Customer service and support
   - Tools: Knowledge base search, memory recall
   - Provider: OpenAI GPT-4

## Configuration

### Agent Configuration Structure

```typescript
interface AgentConfiguration {
  id: string;
  name: string;
  description: string;
  icon?: string;
  defaultProvider: string;
  defaultModel: string;
  systemPrompt: string;
  selectedTools: AgentTool[];
  toolCallingEnabled: boolean;
  enabledMCPServers: string[];
  temperature?: number;
  maxTokens?: number;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  tags?: string[];
}
```

### Tool Configuration

```typescript
interface AgentTool {
  name: string;
  description: string;
  category: 'internal' | 'mcp' | 'memory' | 'web' | 'file' | 'system';
  serverId?: string; // For MCP tools
  enabled: boolean;
  inputSchema?: Record<string, unknown>;
}
```

## API Reference

### Agent Service Methods

- `getAgents()`: Retrieve all agents
- `getAgent(id)`: Get specific agent
- `createAgent(request)`: Create new agent
- `updateAgent(request)`: Update existing agent
- `deleteAgent(id)`: Delete agent
- `duplicateAgent(id, newName?)`: Clone agent
- `exportAgent(id)`: Export agent to JSON
- `importAgent(exportData)`: Import agent from JSON
- `validateAgent(id)`: Validate agent configuration
- `generatePrompt(request)`: Generate AI prompt

### Integration Methods

- `getAvailableTools()`: Get all available tools
- `getTemplates()`: Get agent templates

## Best Practices

### Agent Design
1. **Clear Purpose**: Define specific use cases for each agent
2. **Appropriate Tools**: Select only necessary tools to avoid confusion
3. **Descriptive Prompts**: Create detailed system prompts that guide behavior
4. **Consistent Naming**: Use clear, descriptive names and icons

### Tool Selection
1. **Minimal Set**: Choose only tools needed for the agent's purpose
2. **Category Grouping**: Group related tools together
3. **Security Consideration**: Be mindful of tool permissions and access

### Prompt Engineering
1. **Specific Instructions**: Provide clear guidance on agent behavior
2. **Tool Usage**: Include instructions on when and how to use tools
3. **Context Setting**: Establish the agent's role and expertise
4. **Iterative Refinement**: Test and refine prompts based on performance

## Troubleshooting

### Common Issues

1. **Missing Tools**: Agent validation shows missing tools
   - Solution: Install required MCP servers or update tool selection

2. **Prompt Generation Fails**: AI prompt generation returns errors
   - Solution: Check provider API keys and model availability

3. **Agent Not Loading**: Agent doesn't appear in dropdown
   - Solution: Check agent validation and fix configuration errors

4. **Tool Access Issues**: Agent can't access selected tools
   - Solution: Verify MCP server connections and tool availability

### Debugging

1. **Check Console**: Look for error messages in browser console
2. **Validate Configuration**: Use agent validation feature
3. **Test Tools**: Verify individual tool functionality
4. **Review Logs**: Check application logs for detailed error information

## Future Enhancements

### Planned Features
1. **Agent Analytics**: Usage statistics and performance metrics
2. **Agent Marketplace**: Community sharing of agents
3. **Advanced Templates**: More specialized agent templates
4. **Workflow Integration**: Chain multiple agents together
5. **Version Control**: Track agent changes and rollback capability

### Extension Points
1. **Custom Tool Integration**: Add new tool categories
2. **Provider Plugins**: Support for additional LLM providers
3. **Template System**: User-defined template creation
4. **Agent Scripting**: Programmatic agent behavior definition
