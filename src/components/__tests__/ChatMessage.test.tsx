import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  it('renders user message as plain text', () => {
    const { container } = render(<ChatMessage content="Hello world" role="user" />);
    expect(container.textContent).toContain('Hello world');
  });

  it('renders assistant message with markdown bold', () => {
    const { container } = render(<ChatMessage content="This is **bold** text" role="assistant" />);
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders code blocks with pre/code', () => {
    const { container } = render(
      <ChatMessage content={'```js\nconsole.log("hi")\n```'} role="assistant" />
    );
    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();
  });

  it('renders file badges for new file markers', () => {
    const { container } = render(
      <ChatMessage content="[NEW_FILE:src/app.ts]" role="assistant" />
    );
    expect(container.textContent).toContain('src/app.ts');
  });

  it('applies different styles for user vs assistant', () => {
    const { container: userC } = render(<ChatMessage content="Hi" role="user" />);
    const { container: assistC } = render(<ChatMessage content="Hi" role="assistant" />);
    const userDiv = userC.firstElementChild;
    const assistDiv = assistC.firstElementChild;
    expect(userDiv?.className).not.toBe(assistDiv?.className);
  });

  it('renders system message', () => {
    const { container } = render(<ChatMessage content="System message" role="system" />);
    expect(container.textContent).toContain('System message');
  });
});
