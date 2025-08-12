// Replicate provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for Replicate

import { generateComplexToolPrompt } from './shared-complex-prompt';
import { debugLogger } from '../../debugLogger';

export function generateReplicateToolPrompt(tools: unknown[]): string {
  return generateComplexToolPrompt(tools);
}

// Default system prompt (empty string as in original)
export const REPLICATE_SYSTEM_PROMPT = '';

export default REPLICATE_SYSTEM_PROMPT;
