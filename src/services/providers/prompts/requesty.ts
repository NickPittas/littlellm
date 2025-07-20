// Requesty provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for Requesty

import { generateComplexToolPrompt } from './shared-complex-prompt';

export function generateRequestyToolPrompt(tools: unknown[]): string {
  return generateComplexToolPrompt(tools);
}

// Default system prompt (empty string as in original)
export const REQUESTY_SYSTEM_PROMPT = '';

export default REQUESTY_SYSTEM_PROMPT;
