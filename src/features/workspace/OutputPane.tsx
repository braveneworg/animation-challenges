import { Tabs } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { ConsolePanel } from '@/features/workspace/ConsolePanel';
import { ResultsPanel, type ResultsPanelProps } from '@/features/workspace/ResultsPanel';
import type { ConsoleLine, PreviewFrameStatus } from '@/features/workspace/use-preview-frame';
import { cn } from '@/lib/utils';

export type OutputTab = 'preview' | 'console' | 'results';
export type PreviewView = 'yours' | 'target' | 'side-by-side';

export interface OutputPaneProps {
  activeTab: OutputTab;
  // Property-style function types (not method shorthand): destructuring a method-shorthand
  // signature trips oxlint's type-aware `typescript/unbound-method` (the callback has no `this`
  // to lose, but the rule can't tell method syntax from a real method). Same call surface.
  onTabChange: (tab: OutputTab) => void;
  previewView: PreviewView;
  onPreviewViewChange: (view: PreviewView) => void;
  yoursContainerRef: React.RefObject<HTMLDivElement | null>;
  targetContainerRef: React.RefObject<HTMLDivElement | null>;
  yoursStatus: PreviewFrameStatus;
  targetStatus: PreviewFrameStatus;
  onRecreatePreviews: () => void;
  consoleLines: readonly ConsoleLine[];
  onClearConsole: () => void;
  results: ResultsPanelProps;
}

const OUTPUT_TABS: readonly OutputTab[] = ['preview', 'console', 'results'];
const PREVIEW_VIEWS: ReadonlyArray<{ value: PreviewView; label: string }> = [
  { value: 'yours', label: 'Yours' },
  { value: 'target', label: 'Target' },
  { value: 'side-by-side', label: 'Side by side' },
];

function parseOutputTab(value: string): OutputTab {
  return OUTPUT_TABS.find((tab) => tab === value) ?? 'preview';
}

/**
 * Frames must never re-parent (an iframe reloads when moved) and hidden frames must never be
 * display:none (Plan 02: it kills layout and animations). The preview panel therefore stays
 * mounted (forceMount + offscreen + inert when inactive) and the Yours/Target containers toggle
 * between in-flow and offscreen positioning.
 */
export function OutputPane({
  activeTab,
  onTabChange,
  previewView,
  onPreviewViewChange,
  yoursContainerRef,
  targetContainerRef,
  yoursStatus,
  targetStatus,
  onRecreatePreviews,
  consoleLines,
  onClearConsole,
  results,
}: OutputPaneProps): React.JSX.Element {
  const previewActive = activeTab === 'preview';
  const showYours = previewView !== 'target';
  const showTarget = previewView !== 'yours';
  const anyFrameFailed = yoursStatus === 'failed' || (showTarget && targetStatus === 'failed');

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => onTabChange(parseOutputTab(value))}
      className="relative flex h-full min-h-0 flex-col"
    >
      <Tabs.List aria-label="Output" className="border-border flex gap-1 border-b px-2 py-1">
        <Tabs.Trigger value="preview" className="data-[state=active]:bg-accent rounded-md px-2 py-1 text-sm">
          Preview
        </Tabs.Trigger>
        <Tabs.Trigger value="console" className="data-[state=active]:bg-accent rounded-md px-2 py-1 text-sm">
          Console
        </Tabs.Trigger>
        <Tabs.Trigger value="results" className="data-[state=active]:bg-accent rounded-md px-2 py-1 text-sm">
          Results
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content
        value="preview"
        forceMount
        inert={previewActive ? undefined : true}
        className={cn(
          'min-h-0 flex-1',
          previewActive ? 'flex flex-col' : 'pointer-events-none absolute -left-[200vw] h-64 w-full overflow-hidden',
        )}
      >
        <fieldset className="m-0 flex gap-1 border-0 p-2">
          <legend className="sr-only">Preview view</legend>
          {PREVIEW_VIEWS.map((view) => (
            <Button
              key={view.value}
              type="button"
              size="sm"
              variant={previewView === view.value ? 'secondary' : 'ghost'}
              aria-pressed={previewView === view.value}
              onClick={() => onPreviewViewChange(view.value)}
            >
              {view.label}
            </Button>
          ))}
        </fieldset>
        {anyFrameFailed ? (
          <div className="p-2">
            <p role="alert" className="text-destructive text-sm">
              The preview frame stopped responding.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onRecreatePreviews}>
              Recreate preview
            </Button>
          </div>
        ) : null}
        <div
          className={cn(
            'min-h-0 flex-1',
            previewView === 'side-by-side' ? 'grid grid-cols-2 gap-2 p-2' : 'relative p-2',
          )}
        >
          <div
            ref={yoursContainerRef}
            aria-label="Your output"
            aria-hidden={showYours ? undefined : true}
            className={cn('h-full overflow-auto', showYours ? '' : 'pointer-events-none absolute -left-[10000px]')}
          />
          <div
            ref={targetContainerRef}
            aria-label="Target output"
            aria-hidden={showTarget ? undefined : true}
            className={cn('h-full overflow-auto', showTarget ? '' : 'pointer-events-none absolute -left-[10000px]')}
          />
        </div>
      </Tabs.Content>

      <Tabs.Content value="console" className="min-h-0 flex-1">
        <ConsolePanel lines={consoleLines} onClear={onClearConsole} />
      </Tabs.Content>

      <Tabs.Content value="results" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <ResultsPanel {...results} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
