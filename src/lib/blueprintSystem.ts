/**
 * Blueprint System - Simplified for Chat-First architecture
 * The AI proposes blueprints naturally in conversation, no forced JSON format.
 */

export interface BlueprintFile {
  path: string;
  description: string;
}

export interface Blueprint {
  name: string;
  description: string;
  files: BlueprintFile[];
  cdnDependencies: string[];
  structure: string;
}

/**
 * Parse blueprint JSON from LLM response (if the AI chooses to include one)
 */
export function parseBlueprintResponse(content: string): Blueprint | null {
  try {
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)```/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.name && parsed.files && Array.isArray(parsed.files)) {
      return {
        name: parsed.name || 'Untitled Project',
        description: parsed.description || '',
        files: parsed.files.map((f: any) => ({ path: f.path, description: f.description || '' })),
        cdnDependencies: parsed.cdnDependencies || [],
        structure: parsed.structure || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a generation prompt from an approved blueprint
 */
export function buildGenerationPrompt(blueprint: Blueprint): string {
  const fileList = blueprint.files.map(f => `- ${f.path}: ${f.description}`).join('\n');
  const cdnList = blueprint.cdnDependencies.length > 0
    ? `\nInclude these CDN dependencies: ${blueprint.cdnDependencies.join(', ')}`
    : '';

  return `Now generate the complete code for the project "${blueprint.name}".
  
Project description: ${blueprint.description}
Architecture: ${blueprint.structure}

Files to generate:
${fileList}
${cdnList}

Generate ALL files with complete, working code. Use "// filename: path" markers at the start of each code block.`;
}
