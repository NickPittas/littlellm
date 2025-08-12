// N8N provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for N8N

import { generateComplexToolPrompt } from './shared-complex-prompt';
import { debugLogger } from '../../debugLogger';

export function generateN8NToolPrompt(tools: unknown[]): string {
  return generateComplexToolPrompt(tools);
}

// Default system prompt (empty string as in original)
export const N8N_SYSTEM_PROMPT = '';

export default N8N_SYSTEM_PROMPT;
