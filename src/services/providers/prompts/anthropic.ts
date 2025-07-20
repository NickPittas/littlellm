// Anthropic provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for Anthropic

export function generateAnthropicToolPrompt(tools: unknown[]): string {
  // Type guard for tool objects - EXACT copy from original
  const isToolObject = (t: unknown): t is { function?: { name?: string; description?: string; parameters?: Record<string, unknown> } } => {
    return typeof t === 'object' && t !== null;
  };

  // Dynamic tool categorization based on actual tool names and descriptions - EXACT copy from original
  const categorizeTools = (tools: unknown[]) => {
    const categories: Record<string, unknown[]> = {};

    tools.forEach(tool => {
      if (!isToolObject(tool) || !tool.function?.name) return;

      const name = tool.function.name.toLowerCase();
      const desc = (tool.function.description || '').toLowerCase();

      // Dynamic categorization based on keywords in names and descriptions
      let category = 'general';

      if (name.includes('search') || desc.includes('search') ||
          name.includes('web') || desc.includes('web') ||
          name.includes('internet') || desc.includes('internet')) {
        category = 'search';
      } else if (name.includes('memory') || desc.includes('memory') ||
                 name.includes('remember') || desc.includes('remember')) {
        category = 'memory';
      } else if (name.includes('file') || desc.includes('file') ||
                 name.includes('document') || desc.includes('document') ||
                 name.includes('read') || name.includes('write')) {
        category = 'files';
      } else if (name.includes('data') || desc.includes('data') ||
                 name.includes('database') || desc.includes('database') ||
                 name.includes('sql') || desc.includes('query')) {
        category = 'data';
      } else if (name.includes('api') || desc.includes('api') ||
                 name.includes('http') || desc.includes('http') ||
                 name.includes('request') || desc.includes('request')) {
        category = 'api';
      } else if (name.includes('code') || desc.includes('code') ||
                 name.includes('git') || desc.includes('git') ||
                 name.includes('repo') || desc.includes('repository')) {
        category = 'development';
      } else if (name.includes('time') || desc.includes('time') ||
                 name.includes('date') || desc.includes('date') ||
                 name.includes('calendar') || desc.includes('calendar')) {
        category = 'time';
      } else if (name.includes('image') || desc.includes('image') ||
                 name.includes('photo') || desc.includes('photo') ||
                 name.includes('visual') || desc.includes('visual')) {
        category = 'media';
      }

      if (!categories[category]) categories[category] = [];
      categories[category].push(tool);
    });

    return categories;
  };

  const toolCategories = categorizeTools(tools);

  let instructions = `
[PLANNER MODE ACTIVE]

You are a reasoning assistant that can use tools (functions) to complete complex tasks.

You must always:
- First think step-by-step.
- Identify **each sub-task**.
- For each sub-task, if a tool is needed, call the tool using strict structured output.
- You may call **multiple tools in one response**, BUT each tool call must be **separate and atomic**.

Never answer the user directly until tool results are received.

NEVER explain what you are doing before or after the tool call. Only respond with tool calls when needed.

## Strategic Tool Usage

**Use tools for**:
- Current information (weather, news, stock prices, etc.)
- File operations or system commands
- Complex calculations or data analysis
- Information beyond your training cutoff
- Real-time data that changes frequently

**Use conversation for**:
- General knowledge questions
- Casual conversation
- Explaining concepts or providing advice
- Historical information or established facts

## Multi-Tool Execution Rules

When given a complex request:

1. **Think**: Break down into sub-tasks
2. **Identify**: Which tools are needed for each sub-task
3. **Execute**: Call each tool separately and atomically
4. **Wait**: For all tool results before responding
5. **Summarize**: Provide final natural language response

Be precise, ordered, and structured. Avoid combining tasks in one tool if they require separate calls.

**CRITICAL**: Only use tools from the available list below. Do not invent tool names.

## Available Tools

You have access to ${tools.length} specialized tools:


`;

  // Add tool categories and descriptions - EXACT copy from original
  const categoryIcons: Record<string, string> = {
    search: '🔍',
    memory: '🧠',
    files: '📁',
    data: '💾',
    api: '🌐',
    development: '💻',
    time: '⏰',
    media: '🎨',
    general: '⚡'
  };

  Object.entries(toolCategories).forEach(([category, categoryTools]) => {
    if (categoryTools.length === 0) return;

    const icon = categoryIcons[category] || '🔧';
    instructions += `\n### ${icon} ${category.toUpperCase()} (${categoryTools.length} tools)\n`;

    categoryTools.forEach(tool => {
      if (isToolObject(tool) && tool.function?.name) {
        instructions += `- **${tool.function.name}**: ${tool.function.description || 'No description'}\n`;
      }
    });
  });

  instructions += `

## Tool Usage Format

Use XML-style tags for tool calls:
\`\`\`xml
<tool_name>
<parameter>value</parameter>
</tool_name>
\`\`\`

## Multi-Tool Execution

You can call multiple tools simultaneously or in sequence to complete complex requests:

**Parallel Execution** (multiple tools at once):
- When user asks for multiple independent pieces of information
- Example: "Get weather and news" → call web_search twice with different queries
- Example: "Search for X and remember Y" → call search tool and memory_store

**Sequential Execution** (one after another):
- When one tool's output is needed for the next tool
- Example: Search for information, then store the results in memory
- Example: Get current time, then search for time-sensitive information

**Multi-Tool Patterns**:
- Information gathering: Use multiple search tools for comprehensive results
- Research + Storage: Search for information, then save key findings to memory
- Context + Action: Get current context (time, location) then perform relevant searches

`;

  return instructions;
}

// Default system prompt (empty string as in original)
export const ANTHROPIC_SYSTEM_PROMPT = '';

export default ANTHROPIC_SYSTEM_PROMPT;
