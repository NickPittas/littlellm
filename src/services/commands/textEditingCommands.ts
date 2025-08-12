/**
 * Text Editing Command Implementations
 * Implements DesktopCommanderMCP text editing functionality as internal commands
 */

import {
  CommandResult,
  InternalCommandTool,
  EditBlockArgs
} from '../../types/internalCommands';
import { filesystemManager } from '../filesystemManager';
import { internalCommandService } from '../internalCommandService';
import { debugLogger } from '../debugLogger';

/**
 * Apply surgical text replacements to files
 */
async function editBlock(args: unknown): Promise<CommandResult> {
  try {
    const { file_path, old_string, new_string, expected_replacements } = args as EditBlockArgs;

    // Path validation will be handled in the main process

    // Read the current file content
    const fileResult = await filesystemManager.readFile(file_path);
    if (fileResult.isImage) {
      throw new Error('Cannot edit binary/image files');
    }

    const content = fileResult.content;

    // Perform the replacement
    const replacementCount = expected_replacements || 1;
    let actualReplacements = 0;
    let newContent = content;

    if (replacementCount === 1) {
      // Single replacement
      const index = content.indexOf(old_string);
      if (index !== -1) {
        newContent = content.substring(0, index) + new_string + content.substring(index + old_string.length);
        actualReplacements = 1;
      }
    } else {
      // Multiple replacements
      const regex = new RegExp(escapeRegExp(old_string), 'g');
      const matches = content.match(regex);
      actualReplacements = matches ? matches.length : 0;
      
      if (actualReplacements > 0) {
        newContent = content.replace(regex, new_string);
      }
    }

    // Check if replacement was successful
    if (actualReplacements === 0) {
      // Try fuzzy search to help user understand what went wrong
      const fuzzyResult = await performFuzzySearch(content, old_string);
      
      let errorMessage = `No exact matches found for the search text in ${file_path}.`;
      
      if (fuzzyResult.bestMatch) {
        errorMessage += `\n\nClosest match found (${fuzzyResult.similarity}% similar):\n`;
        errorMessage += `"${fuzzyResult.bestMatch}"\n\n`;
        errorMessage += `Character differences:\n${fuzzyResult.diff}`;
      }
      
      return internalCommandService.createErrorResponse(errorMessage);
    }

    if (expected_replacements && actualReplacements !== expected_replacements) {
      return internalCommandService.createErrorResponse(
        `Expected ${expected_replacements} replacements but found ${actualReplacements} matches`
      );
    }

    // Write the modified content back to the file
    await filesystemManager.writeFile(file_path, newContent, 'rewrite');

    // Check line count for performance warning
    const lines = newContent.split('\n');
    const config = internalCommandService.getConfiguration();
    const maxLines = config.fileWriteLineLimit;

    let message = `Successfully applied ${actualReplacements} replacement(s) in ${file_path}`;
    
    if (lines.length > maxLines) {
      message += `\n💡 Performance tip: File has ${lines.length} lines. Consider breaking edits into smaller, more focused changes.`;
    }

    return internalCommandService.createSuccessResponse(message);

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Perform fuzzy search to find closest match
 */
async function performFuzzySearch(content: string, searchText: string): Promise<{
  bestMatch: string | null;
  similarity: number;
  diff: string;
}> {
  const lines = content.split('\n');
  let bestMatch: string | null = null;
  let bestSimilarity = 0;
  let bestDiff = '';

  // Search for the best matching substring
  const searchLength = searchText.length;
  const threshold = 0.6; // Minimum similarity threshold

  for (let i = 0; i < content.length - searchLength + 1; i++) {
    const substring = content.substring(i, i + searchLength);
    const similarity = calculateSimilarity(searchText, substring);
    
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = substring;
      bestDiff = generateCharacterDiff(searchText, substring);
    }
  }

  // Also check line-by-line for better context
  for (const line of lines) {
    const similarity = calculateSimilarity(searchText, line);
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = line;
      bestDiff = generateCharacterDiff(searchText, line);
    }
  }

  return {
    bestMatch,
    similarity: Math.round(bestSimilarity * 100),
    diff: bestDiff
  };
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

/**
 * Generate character-level diff showing differences
 */
function generateCharacterDiff(expected: string, actual: string): string {
  let result = '';
  let i = 0, j = 0;

  while (i < expected.length || j < actual.length) {
    if (i < expected.length && j < actual.length && expected[i] === actual[j]) {
      result += expected[i];
      i++;
      j++;
    } else if (i < expected.length && (j >= actual.length || expected[i] !== actual[j])) {
      result += `{-${expected[i]}-}`;
      i++;
    } else if (j < actual.length) {
      result += `{+${actual[j]}+}`;
      j++;
    }
  }

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Export text editing command tools
export const textEditingCommands: InternalCommandTool[] = [
  {
    name: 'edit_block',
    description: `Apply surgical text replacements to files.
    
BEST PRACTICE: Make multiple small, focused edits rather than one large edit.
Each edit_block call should change only what needs to be changed - include just enough context to uniquely identify the text being modified.

Takes:
- file_path: Path to the file to edit
- old_string: Text to replace
- new_string: Replacement text
- expected_replacements: Optional parameter for number of replacements

By default, replaces only ONE occurrence of the search text. To replace multiple occurrences, provide the expected_replacements parameter with the exact number of matches expected.

UNIQUENESS REQUIREMENT: When expected_replacements=1 (default), include the minimal amount of context necessary (typically 1-3 lines) before and after the change point, with exact whitespace and indentation.

When a close but non-exact match is found, a character-level diff is shown in the format:
common_prefix{-removed-}{+added+}common_suffix
to help you identify what's different.

Parameters:
- file_path: Path to the file to edit
- old_string: Text to find and replace
- new_string: Replacement text
- expected_replacements: Number of expected replacements (optional, default: 1)`,
    category: 'textEditing',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file to edit' },
        old_string: { type: 'string', description: 'Text to find and replace' },
        new_string: { type: 'string', description: 'Replacement text' },
        expected_replacements: { 
          type: 'number', 
          description: 'Number of expected replacements (default: 1)' 
        }
      },
      required: ['file_path', 'old_string', 'new_string']
    },
    handler: editBlock
  }
];
