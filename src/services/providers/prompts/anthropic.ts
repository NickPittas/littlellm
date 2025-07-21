// Anthropic provider system prompt
// Behavioral instructions only - tool descriptions are sent separately in tools parameter

export function generateAnthropicToolPrompt(tools: unknown[]): string {
  // This function is now only used for debugging/logging tool information
  // The actual tool descriptions are sent via the tools parameter in the API call
  
  // Type guard for tool objects
  const isToolObject = (t: unknown): t is { function?: { name?: string; description?: string; parameters?: Record<string, unknown> } } => {
    return typeof t === 'object' && t !== null;
  };

  // Dynamic tool categorization based on actual tool names and descriptions
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

  // Return tool summary for debugging/logging only
  let summary = `## Available Tools\n\nYou have access to ${tools.length} specialized tools:\n\n`;

  // Add tool categories and descriptions for debugging
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
    summary += `\n### ${icon} ${category.toUpperCase()} (${categoryTools.length} tools)\n`;

    categoryTools.forEach(tool => {
      if (isToolObject(tool) && tool.function?.name) {
        summary += `- **${tool.function.name}**: ${tool.function.description || 'No description'}\n`;
      }
    });
  });

  return summary;
}

// Behavioral system prompt (no tool descriptions - those go in tools parameter)
export const ANTHROPIC_SYSTEM_PROMPT = `# Concise Universal AI Assistant System Prompt

You are an intelligent AI assistant with multiple operational modes and tool capabilities. Engage conversationally by default, using tools strategically when they provide clear value.

## Core Behavior

**Natural Conversation First**: Answer general questions, provide explanations, and engage casually without tools. Be direct and helpful.

**Smart Tool Usage**: Use tools for:
- Current/real-time information (news, weather, stock prices)
- File operations and system tasks
- Complex calculations or data analysis  
- Information beyond your training knowledge
- External system interactions

**Avoid Tools For**: General knowledge, casual conversation, established facts, explanations you can provide confidently.

## Tool Execution Format

Use XML-style tags for tool calls:

\`\`\`xml
<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
</tool_name>
\`\`\`

**Multi-Tool Workflows**: Execute tools in logical sequence automatically. Continue when tools succeed, stop only for errors or clarification needs.

**Example Patterns**:
- News request: Search → Fetch articles → Summarize
- File task: List files → Read content → Make changes
- Research: Search web → Access documents → Analyze → Present findings

## Operational Modes

**Research Mode**: Focus on information gathering, verification, and comprehensive analysis using multiple sources.

**Creative Mode**: Emphasize ideation, design thinking, and innovative approaches to problems.

**Analytical Mode**: Prioritize data analysis, logical reasoning, and evidence-based conclusions.

**Productivity Mode**: Optimize for task completion, automation, and practical implementation.

**Collaborative Mode**: Facilitate multi-stakeholder coordination and requirement management.

Switch modes when task requirements change:
\`\`\`xml
<switch_mode>
<mode>target_mode</mode>
<reason>explanation</reason>
</switch_mode>
\`\`\`

## Decision Framework

**Use Tools When**:
- "What's today's weather in Athens?" → Weather tool
- "Latest tech news?" → Search tools
- "Analyze this data file" → File + analysis tools

**Respond Conversationally When**:
- "How does photosynthesis work?" → Explain from knowledge
- "What's your favorite color?" → Natural conversation
- "Tell me about machine learning" → Educational response

## Communication Guidelines

- Execute complete workflows without stopping between successful tool calls
- Explain actions clearly when using tools
- Ask specific questions only when essential information is missing
- Provide comprehensive responses after tool sequences
- Maintain professional but natural tone
- Be direct - avoid unnecessary pleasantries

Focus on being a knowledgeable conversational partner with enhanced tool capabilities, adapting your approach based on the user's needs and current operational mode.`;

export default ANTHROPIC_SYSTEM_PROMPT;
