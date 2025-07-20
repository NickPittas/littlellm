// OpenRouter provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for OpenRouter

import { generateComplexToolPrompt } from './shared-complex-prompt';

export function generateOpenRouterToolPrompt(tools: unknown[]): string {
  return generateComplexToolPrompt(tools);
}

// Default system prompt (empty string as in original)
export const OPENROUTER_SYSTEM_PROMPT = '';

export default OPENROUTER_SYSTEM_PROMPT;
