import { indentMore } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';

import { Button } from '@/components/ui/button';

export const TOOLBAR_SYMBOLS: readonly string[] = ['{', '}', '(', ')', ':', ';', '=>', '%'];

export function insertSymbol(view: EditorView, symbol: string): void {
  view.dispatch(view.state.replaceSelection(symbol));
  view.focus();
}

/**
 * Spec §5.2 mobile symbol toolbar: sticky above the keyboard, supplying characters buried on phone
 * layouts, plus an indent key. `onPointerDown` preventDefault keeps the editor focused (and the
 * software keyboard open) while the button is pressed. Hidden at and above the `md` breakpoint.
 */
export function EditorToolbar({ view }: { view: EditorView | null }): React.JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label="Editor symbols"
      className="border-border bg-background sticky bottom-0 flex gap-1 overflow-x-auto border-t p-1 md:hidden"
    >
      {TOOLBAR_SYMBOLS.map((symbol) => (
        <Button
          key={symbol}
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Insert ${symbol}`}
          disabled={view === null}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            if (view !== null) insertSymbol(view, symbol);
          }}
          className="min-w-9 font-mono"
        >
          {symbol}
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Indent line"
        disabled={view === null}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          if (view !== null) {
            // `view.dispatch` is a real class method (implicit `this`), so it is bound before being
            // handed to `indentMore` as a bare reference — same pattern as `win.setTimeout.bind(win)`
            // in src/sandbox/harness.ts — to satisfy `typescript/unbound-method`.
            indentMore({ state: view.state, dispatch: view.dispatch.bind(view) });
            view.focus();
          }
        }}
        className="min-w-9"
      >
        ⇥
      </Button>
    </div>
  );
}
