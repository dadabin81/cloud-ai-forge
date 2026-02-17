/**
 * Blueprint System - Phased project generation
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
 * Detect if the user prompt is asking for a new project (needs blueprint)
 * vs a modification of an existing project (incremental edit)
 */
export function detectBlueprintRequest(prompt: string, hasExistingFiles: boolean): boolean {
  if (hasExistingFiles) return false;
  const newProjectPatterns = [
    /\b(crea|create|build|make|genera|develop|diseña|design)\b.*\b(app|application|website|page|sitio|pagina|dashboard|landing|portfolio|blog|tienda|store|proyecto|project)\b/i,
    /\b(quiero|want|necesito|need)\b.*\b(una?|an?)\b.*\b(app|web|page|sitio|dashboard|landing)\b/i,
    /\bhaz(me)?\b.*\b(una?|an?)\b/i,
  ];
  return newProjectPatterns.some(p => p.test(prompt));
}

/**
 * Build a system prompt that forces the LLM to respond with a blueprint JSON first
 */
export function buildBlueprintPrompt(): string {
  return `Before generating any code, respond ONLY with a JSON blueprint wrapped in \`\`\`json tags.
The blueprint must follow this exact structure:

\`\`\`json
{
  "name": "Project Name",
  "description": "Brief description of the project",
  "files": [
    { "path": "index.html", "description": "Main HTML entry point" },
    { "path": "styles.css", "description": "Global styles" },
    { "path": "App.jsx", "description": "Main React component" }
  ],
  "cdnDependencies": ["tailwindcss", "chart.js"],
  "structure": "Brief description of the architecture"
}
\`\`\`

Do NOT generate any code yet. Only respond with the blueprint JSON above.`;
}

/**
 * Parse blueprint JSON from LLM response
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
