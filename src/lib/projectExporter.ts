import { zipSync, strToU8 } from 'fflate';
import type { ProjectFile } from '@/lib/projectGenerator';
import { buildProjectPreview } from '@/lib/projectGenerator';

/**
 * Export project as a ZIP file and trigger download
 */
export function exportAsZip(files: Record<string, ProjectFile>, projectName: string = 'project') {
  const zipData: Record<string, Uint8Array> = {};
  for (const [path, file] of Object.entries(files)) {
    zipData[path] = strToU8(file.code);
  }
  const zipped = zipSync(zipData);
  const blob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
  triggerDownload(blob, `${projectName}.zip`);
}

/**
 * Export project as a single HTML file
 */
export function exportAsHtml(files: Record<string, ProjectFile>, projectName: string = 'project') {
  const html = buildProjectPreview(files);
  const blob = new Blob([html], { type: 'text/html' });
  triggerDownload(blob, `${projectName}.html`);
}

/**
 * Export project as JSON (files + metadata)
 */
export function exportAsJson(
  files: Record<string, ProjectFile>,
  metadata: { name: string; template?: string } = { name: 'Untitled' }
) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    name: metadata.name,
    template: metadata.template || 'vanilla-js',
    files,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${metadata.name.replace(/\s+/g, '-').toLowerCase()}.binario.json`);
}

/**
 * Import a project from a JSON file. Returns parsed files + metadata or null on failure.
 */
export async function importFromJson(
  file: File
): Promise<{ files: Record<string, ProjectFile>; name: string; template: string } | null> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.files || typeof data.files !== 'object') return null;
    return {
      files: data.files as Record<string, ProjectFile>,
      name: data.name || 'Imported Project',
      template: data.template || 'vanilla-js',
    };
  } catch {
    return null;
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
