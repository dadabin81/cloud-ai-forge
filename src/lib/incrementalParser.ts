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
 * Supported markers:
 *   [NEW_FILE: path/to/file.ext]
 *   [EDIT_FILE: path/to/file.ext]
 *   [DELETE_FILE: path/to/file.ext]
 * 
 * Each marker is followed by a code block with the file content.
 * DELETE_FILE does not require a code block.
 */
export function parseIncrementalActions(content: string): FileAction[] {
  const actions: FileAction[] = [];

  // Match [NEW_FILE: ...] or [EDIT_FILE: ...] followed by a code block
  const fileRegex = /\[(NEW_FILE|EDIT_FILE):\s*([^\]]+)\]\s*\n```(\w+)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const type = match[1] === 'NEW_FILE' ? 'new' : 'edit';
    const path = match[2].trim();
    const lang = match[3];
    const code = match[4].trim();
    actions.push({ type, path, code, language: lang || detectLanguage(path) });
  }

  // Match [DELETE_FILE: ...]
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
 * Strip incremental markers from content for display purposes,
 * leaving only the explanation text.
 */
export function stripIncrementalMarkers(content: string): string {
  // Remove [ACTION: path] markers and their code blocks
  let cleaned = content.replace(
    /\[(NEW_FILE|EDIT_FILE):\s*[^\]]+\]\s*\n```\w*\s*\n[\s\S]*?```/g,
    '',
  );
  cleaned = cleaned.replace(/\[DELETE_FILE:\s*[^\]]+\]/g, '');
  // Clean up excessive whitespace
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build a system prompt context that tells the AI about existing files,
 * enabling it to use incremental editing.
 */
export function buildFileContextPrompt(files: Record<string, ProjectFile>): string {
  const fileList = Object.keys(files);
  if (fileList.length === 0) return '';

  const fileSummary = fileList
    .map(path => {
      const lines = files[path].code.split('\n').length;
      return `  - ${path} (${files[path].language}, ${lines} lines)`;
    })
    .join('\n');

  return `\n\nCURRENT PROJECT FILES:\n${fileSummary}\n\nIMPORTANT: This project already has files. Use these commands to modify them:\n- [NEW_FILE: path] to create a new file\n- [EDIT_FILE: path] to replace an existing file with updated content\n- [DELETE_FILE: path] to remove a file\nOnly include files that need changes. Do NOT regenerate unchanged files.`;
}
