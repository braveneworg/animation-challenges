import { Marked } from 'marked';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

const marked = new Marked({ gfm: true });

export function renderMarkdownToHtml(source: string): string {
  const html = marked.parse(source);
  if (typeof html !== 'string') throw new Error('markdown rendering was unexpectedly async');
  return html;
}

interface MarkdownProps {
  source: string;
  className?: string | undefined;
}

/**
 * Renders FIRST-PARTY markdown (challenge briefs, hints, explanations — hand-authored, repo-reviewed).
 * User-typed code never flows through here; the sandbox iframe is where untrusted code lives
 * (spec §6.7). That is why no sanitizer sits between marked and the DOM.
 */
export function Markdown({ source, className }: MarkdownProps): React.JSX.Element {
  const html = useMemo(() => renderMarkdownToHtml(source), [source]);
  return <div className={cn('markdown', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
