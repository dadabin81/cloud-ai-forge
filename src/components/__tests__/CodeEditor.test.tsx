import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';

// Mock sonner
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

describe('CodeEditor', () => {
  it('shows empty state when no filename', () => {
    const { container } = render(<CodeEditor filename={null} code="" language="typescript" />);
    expect(container.textContent?.toLowerCase()).toContain('select');
  });

  it('renders filename in header', () => {
    const { container } = render(<CodeEditor filename="app.tsx" code="const x = 1;" language="typescript" />);
    expect(container.textContent).toContain('app.tsx');
  });

  it('renders line numbers', () => {
    const code = 'line1\nline2\nline3';
    const { container } = render(<CodeEditor filename="test.ts" code={code} language="typescript" />);
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('3');
  });

  it('renders code content', () => {
    const { container } = render(<CodeEditor filename="test.ts" code="const hello = 'world';" language="typescript" />);
    expect(container.textContent).toContain('hello');
  });

  it('shows language badge', () => {
    const { container } = render(<CodeEditor filename="test.ts" code="x" language="typescript" />);
    expect(container.textContent).toContain('typescript');
  });
});
