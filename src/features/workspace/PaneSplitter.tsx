import { useRef } from 'react';

import { MIN_PANE_PERCENT, PANE_KEYBOARD_STEP, resizeAt } from '@/features/workspace/pane-layout';
import type { PaneSizes } from '@/stores/workspace-store';

interface PaneSplitterProps {
  index: 0 | 1;
  sizes: PaneSizes;
  // Property-style function type (not method shorthand): destructuring a method-shorthand
  // signature trips oxlint's type-aware `typescript/unbound-method` (the callback has no `this`
  // to lose, but the rule can't tell method syntax from a real method). Same call surface —
  // matches the convention already established for EditorPane/OutputPane callback props.
  onResize: (sizes: PaneSizes) => void;
  containerRef: React.RefObject<HTMLElement | null>;
  label: string;
}

/**
 * WAI-ARIA window splitter: focusable separator, arrow-key resize, pointer drag with capture.
 * Deliberately a `<div role="separator">`, not the `<hr>` oxlint's `jsx-a11y/prefer-tag-over-role`
 * would otherwise suggest: the WAI-ARIA APG Window Splitter pattern requires role="separator" to
 * be FOCUSABLE (tabIndex + arrow-key handling), and `<hr>` is a non-interactive element — adding
 * tabIndex/key or pointer handlers to it trips `jsx-a11y/no-noninteractive-tabindex` and
 * `no-noninteractive-element-interactions` instead. The two rules want mutually exclusive tags for
 * an interactive separator; `jsx-a11y/prefer-tag-over-role` is scoped off for this file in
 * `.oxlintrc.json` (a config-level override, not an inline disable comment — see that file's
 * comment for the full rationale).
 */
export function PaneSplitter({ index, sizes, onResize, containerRef, label }: PaneSplitterProps): React.JSX.Element {
  const dragRef = useRef<{ startX: number; startSizes: PaneSizes } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(sizes[index])}
      aria-valuemin={MIN_PANE_PERCENT}
      aria-valuemax={100 - 2 * MIN_PANE_PERCENT}
      tabIndex={0}
      className="bg-border hover:bg-ring focus-visible:ring-ring w-1.5 shrink-0 cursor-col-resize rounded-full focus-visible:ring-2 focus-visible:outline-none"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onResize(resizeAt(sizes, index, -PANE_KEYBOARD_STEP));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          onResize(resizeAt(sizes, index, PANE_KEYBOARD_STEP));
        }
      }}
      onPointerDown={(event) => {
        dragRef.current = { startX: event.clientX, startSizes: sizes };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        const container = containerRef.current;
        if (drag === null || container === null) return;
        const width = container.getBoundingClientRect().width;
        if (width <= 0) return;
        const deltaPercent = ((event.clientX - drag.startX) / width) * 100;
        onResize(resizeAt(drag.startSizes, index, deltaPercent));
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
    />
  );
}
