import { describe, expect, it } from 'vitest';

import { renderMarkdownToHtml } from '@/components/ui/markdown';

describe('renderMarkdownToHtml', () => {
  it('renders emphasis, inline code, and paragraphs', () => {
    const html = renderMarkdownToHtml('Move it with **transform**, never `top`.');
    expect(html).toContain('<strong>transform</strong>');
    expect(html).toContain('<code>top</code>');
    expect(html).toContain('<p>');
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdownToHtml('```css\n.card { color: red; }\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('.card { color: red; }');
  });
});
