/**
 * Error Detection and Auto-Correction System
 */

import type { ProjectFile } from './projectGenerator';

export interface PreviewError {
  message: string;
  type: 'runtime' | 'syntax' | 'react' | 'network';
  timestamp: number;
}

const MAX_AUTO_CORRECT_ATTEMPTS = 3;

/**
 * Determine if an error is auto-correctable
 */
export function shouldAutoCorrect(error: PreviewError): boolean {
  const autoFixable = [
    /is not defined/i,
    /is not a function/i,
    /unexpected token/i,
    /syntax error/i,
    /cannot read propert/i,
    /undefined is not/i,
    /missing.*import/i,
    /module not found/i,
    /failed to compile/i,
  ];
  return autoFixable.some(p => p.test(error.message));
}

/**
 * Build a correction prompt for the LLM
 */
export function buildErrorCorrectionPrompt(
  errors: PreviewError[],
  files: Record<string, ProjectFile>
): string {
  const errorList = errors.map(e => `- [${e.type}] ${e.message}`).join('\n');
  const fileList = Object.entries(files)
    .map(([path, f]) => `--- ${path} ---\n${f.code}`)
    .join('\n\n');

  return `The following errors were detected in the preview:

${errorList}

Current project files:
${fileList}

Fix these errors. Use [EDIT_FILE: path] markers to update only the files that need changes. Keep fixes minimal and targeted.`;
}

/**
 * Check if we can still auto-correct (haven't exceeded max attempts)
 */
export function canAutoCorrect(attempts: number): boolean {
  return attempts < MAX_AUTO_CORRECT_ATTEMPTS;
}

/**
 * Classify an error from the iframe postMessage
 */
export function classifyError(message: string): PreviewError['type'] {
  if (/react/i.test(message) || /hook/i.test(message) || /render/i.test(message)) return 'react';
  if (/syntax/i.test(message) || /unexpected token/i.test(message)) return 'syntax';
  if (/fetch|network|cors/i.test(message)) return 'network';
  return 'runtime';
}
