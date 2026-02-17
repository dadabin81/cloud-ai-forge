/**
 * Incremental Parser - Handles NEW_FILE, EDIT_FILE, DELETE_FILE commands
 * from AI responses to enable incremental editing instead of full regeneration.
 */

import type { ProjectFile } from './projectGenerator';

export interface FileAction {
  type: 'new' | 'edit' | 'delete';
  path: string;
  code?: string;
  language?: string;
}

/**
 * Detect language from file extension
 */
function detectLanguage(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    html: 'html', htm: 'html',
    css: 'css', scss: 'css',
    js: 'javascript', mjs: 'javascript',
    jsx: 'jsx', tsx: 'tsx',
    ts: 'typescript',
    json: 'json',
    md: 'markdown',
    svg: 'svg',
  };
  return map[ext] || 'text';
}

/**
 * Parse AI response for incremental file commands.
 */
export function parseIncrementalActions(content: string): FileAction[] {
  const actions: FileAction[] = [];

  const fileRegex = /\[(NEW_FILE|EDIT_FILE):\s*([^\]]+)\]\s*\n```(\w+)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const type = match[1] === 'NEW_FILE' ? 'new' : 'edit';
    const path = match[2].trim();
    const lang = match[3];
    const code = match[4].trim();
    actions.push({ type, path, code, language: lang || detectLanguage(path) });
  }

  const deleteRegex = /\[DELETE_FILE:\s*([^\]]+)\]/g;
  while ((match = deleteRegex.exec(content)) !== null) {
    actions.push({ type: 'delete', path: match[1].trim() });
  }

  return actions;
}

/**
 * Check if content contains incremental edit markers
 */
export function hasIncrementalMarkers(content: string): boolean {
  return /\[(NEW_FILE|EDIT_FILE|DELETE_FILE):/.test(content);
}

/**
 * Apply incremental actions to existing project files.
 * Returns the updated files map.
 */
export function applyIncrementalActions(
  existingFiles: Record<string, ProjectFile>,
  actions: FileAction[],
): Record<string, ProjectFile> {
  const files = { ...existingFiles };

  for (const action of actions) {
    switch (action.type) {
      case 'new':
      case 'edit':
        if (action.code) {
          files[action.path] = {
            code: action.code,
            language: action.language || detectLanguage(action.path),
          };
        }
        break;
      case 'delete':
        delete files[action.path];
        break;
    }
  }

  return files;
}

/**
 * Smart merge: when legacy `// filename:` markers generate files but project already has files,
 * only update the files that appear in the new response. Keep all others untouched.
 */
export function smartMergeFiles(
  existingFiles: Record<string, ProjectFile>,
  newFiles: Record<string, ProjectFile>,
): Record<string, ProjectFile> {
  if (Object.keys(existingFiles).length === 0) return newFiles;
  // Merge: existing files + overwrite only the ones present in newFiles
  return { ...existingFiles, ...newFiles };
}

/**
 * Strip incremental markers from content for display purposes.
 */
export function stripIncrementalMarkers(content: string): string {
  let cleaned = content.replace(
    /\[(NEW_FILE|EDIT_FILE):\s*[^\]]+\]\s*\n```\w*\s*\n[\s\S]*?```/g,
    '',
  );
  cleaned = cleaned.replace(/\[DELETE_FILE:\s*[^\]]+\]/g, '');
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build a system prompt context that tells the AI about existing files,
 * including FULL file contents so the AI can do surgical edits.
 * Truncates large files to keep context manageable.
 */
export function buildFileContextPrompt(files: Record<string, ProjectFile>): string {
  const fileList = Object.keys(files);
  if (fileList.length === 0) return '';

  const MAX_FILE_CHARS = 2000;
  const MAX_TOTAL_CHARS = 12000;
  let totalChars = 0;

  const fileContents = fileList.map(path => {
    const file = files[path];
    const lines = file.code.split('\n').length;
    let content = file.code;
    if (content.length > MAX_FILE_CHARS) {
      content = content.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
    }
    if (totalChars + content.length > MAX_TOTAL_CHARS) {
      totalChars += 50;
      return `--- ${path} (${file.language}, ${lines} lines) ---\n[Content too large, listed only]`;
    }
    totalChars += content.length;
    return `--- ${path} (${file.language}, ${lines} lines) ---\n${content}`;
  }).join('\n\n');

  return `

EXISTING PROJECT FILES (${fileList.length} files):
${fileContents}

CRITICAL INSTRUCTIONS FOR EDITING:
- This project already has files. Do NOT regenerate files that don't need changes.
- To modify an existing file, use: [EDIT_FILE: path] followed by a code block with the COMPLETE updated file content.
- To create a new file, use: [NEW_FILE: path] followed by a code block.
- To delete a file, use: [DELETE_FILE: path]
- ONLY include files that actually need changes. Leave unchanged files alone.
- NEVER use "// filename:" markers when editing existing projects. Always use [EDIT_FILE:] or [NEW_FILE:].`;
}
