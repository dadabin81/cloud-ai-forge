/**
 * Code Extractor - Detects and extracts renderable code blocks from AI chat responses
 */

export interface CodeBlock {
  language: string;
  code: string;
}

/**
 * Extract code blocks from markdown content (triple backtick blocks)
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const language = (match[1] || 'text').toLowerCase();
    const code = match[2].trim();
    if (code) {
      blocks.push({ language, code });
    }
  }

  return blocks;
}

const RENDERABLE_LANGUAGES = new Set([
  'html', 'htm', 'css', 'javascript', 'js', 'jsx', 'tsx', 'react',
]);

/**
 * Determine if extracted code blocks can be previewed visually
 */
export function isRenderableCode(blocks: CodeBlock[]): boolean {
  return blocks.some(b => RENDERABLE_LANGUAGES.has(b.language));
}

/**
 * Check if content contains multi-file project markers
 */
export function hasProjectMarkers(content: string): boolean {
  return /\/\/\s*filename:\s*.+/m.test(content) ||
    /<!--\s*filename:\s*.+-->/m.test(content) ||
    /\*\*`?[^`*\n]+\.\w+`?\*\*\s*\n```/m.test(content) ||
    /#{1,6}\s*`?[^`\n]+\.\w+`?\s*\n```/m.test(content);
}

/**
 * Build a complete HTML document from extracted code blocks
 */
export function buildPreviewDocument(blocks: CodeBlock[]): string {
  const cssBlocks = blocks.filter(b => b.language === 'css').map(b => b.code);
  const jsBlocks = blocks.filter(b => ['javascript', 'js'].includes(b.language)).map(b => b.code);
  const htmlBlocks = blocks.filter(b => ['html', 'htm'].includes(b.language)).map(b => b.code);
  const jsxBlocks = blocks.filter(b => ['jsx', 'tsx', 'react'].includes(b.language)).map(b => b.code);

  const hasJsx = jsxBlocks.length > 0;

  const fullHtml = htmlBlocks.find(h => h.toLowerCase().includes('<!doctype') || h.toLowerCase().includes('<html'));
  if (fullHtml && !hasJsx) {
    let doc = fullHtml;
    if (cssBlocks.length > 0) {
      const cssTag = `<style>\n${cssBlocks.join('\n')}\n</style>`;
      doc = doc.replace('</head>', `${cssTag}\n</head>`);
    }
    if (jsBlocks.length > 0) {
      const jsTag = `<script>\n${jsBlocks.join('\n')}\n</script>`;
      doc = doc.replace('</body>', `${jsTag}\n</body>`);
    }
    return doc;
  }

  if (hasJsx) {
    return buildReactDocument(jsxBlocks, cssBlocks);
  }

  const bodyContent = htmlBlocks.join('\n') || '<p>No HTML content detected</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
${cssBlocks.join('\n')}
</style>
</head>
<body>
${bodyContent}
${jsBlocks.length > 0 ? `<script>\n${jsBlocks.join('\n')}\n</script>` : ''}
</body>
</html>`;
}

function buildReactDocument(jsxBlocks: string[], cssBlocks: string[]): string {
  const jsxCode = jsxBlocks.join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
${cssBlocks.join('\n')}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${jsxCode}

const _names = ['App','Main','Page','Home','Landing','Blog','Component','Hero','Layout'];
for (const _n of _names) {
  try { if (typeof eval(_n)==='function') { ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(eval(_n))); break; } } catch(e) {}
}
</script>
</body>
</html>`;
}
