// DeepSeek provider system prompt
// EXACT copy from original llmService.ts generateComplexToolInstructions method
// This is the complete tool calling prompt used for DeepSeek

import { generateComplexToolPrompt } from './shared-complex-prompt';

export function generateDeepSeekToolPrompt(tools: unknown[]): string {
  return generateComplexToolPrompt(tools);
}

// Default system prompt (empty string as in original)
export const DEEPSEEK_SYSTEM_PROMPT = '';

export default DEEPSEEK_SYSTEM_PROMPT;
