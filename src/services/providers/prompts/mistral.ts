// Mistral AI provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for Mistral

import { generateComplexToolPrompt } from './shared-complex-prompt';

export function generateMistralToolPrompt(tools: unknown[]): string {
  return generateComplexToolPrompt(tools);
}

// Default system prompt (empty string as in original)
export const MISTRAL_SYSTEM_PROMPT = '';

export default MISTRAL_SYSTEM_PROMPT;
