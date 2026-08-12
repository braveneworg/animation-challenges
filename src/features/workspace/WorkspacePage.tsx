import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'radix-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProgressRepository } from '@/app/repository-provider';
import type { Challenge, ChallengeFiles, RuntimeKind } from '@/challenges/types';
import { recordClear } from '@/data/operations';
import { invalidateChallengeData } from '@/data/queries';
import { DRAFT_SAVE_DEBOUNCE_MS, mergedDraftFiles } from '@/features/workspace/draft-files';
import { EditorPane } from '@/features/workspace/EditorPane';
import { OutputPane, type OutputTab, type PreviewView } from '@/features/workspace/OutputPane';
import { clampPaneSizes } from '@/features/workspace/pane-layout';
import { PaneSplitter } from '@/features/workspace/PaneSplitter';
import { previewEnvironment } from '@/features/workspace/preview-environment';
import { PromptPane } from '@/features/workspace/PromptPane';
import { usePreviewFrame } from '@/features/workspace/use-preview-frame';
import { useSubmit } from '@/features/workspace/use-submit';
import { debounce } from '@/lib/debounce';
import { useMediaQuery } from '@/lib/use-media-query';
import { toMountPayload, type MountPayload } from '@/runner/protocol';
import { TranspilerClient } from '@/runner/transpiler-client';
import type { PrepareResult, TranspileDiagnostic } from '@/runner/types';
import { useSettingsStore, useWorkspaceStore } from '@/stores';

export function WorkspacePage({ challenge }: { challenge: Challenge }): React.JSX.Element {
  return <WorkspaceScreen key={challenge.id} challenge={challenge} />;
}

type MobilePane = 'brief' | 'editor' | 'output';
const MOBILE_PANES: readonly MobilePane[] = ['brief', 'editor', 'output'];

function parseMobilePane(value: string): MobilePane {
  return MOBILE_PANES.find((pane) => pane === value) ?? 'brief';
}

function WorkspaceScreen({ challenge }: { challenge: Challenge }): React.JSX.Element {
  const repo = useProgressRepository();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 48rem)');
  const reducedMotionPreview = useSettingsStore((state) => state.settings.reducedMotionPreview);
  const storedState = useWorkspaceStore((state) => state.byChallenge[challenge.id]);
  const setDraftFile = useWorkspaceStore((state) => state.setDraftFile);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const resetChallengeState = useWorkspaceStore((state) => state.resetChallengeState);
  const paneSizes = useWorkspaceStore((state) => state.paneSizes);
  const setPaneSizes = useWorkspaceStore((state) => state.setPaneSizes);
  const lastRunResult = useWorkspaceStore((state) => state.lastRunResult);

  // Working files: starter ∪ persisted drafts. The ref is the always-fresh copy Run/Submit read;
  // the state drives rendering. Store persistence is debounced (§6.6 autosave backstop).
  const [files, setFiles] = useState<Record<string, string>>(() =>
    mergedDraftFiles(challenge.starter, storedState?.draftFiles),
  );
  const filesRef = useRef(files);
  const persistDraft = useMemo(
    () =>
      debounce((path: string, contents: string) => {
        setDraftFile(challenge.id, path, contents);
      }, DRAFT_SAVE_DEBOUNCE_MS),
    [challenge.id, setDraftFile],
  );
  useEffect(() => (): void => persistDraft.flush(), [persistDraft]);

  const filePaths = useMemo(() => Object.keys(challenge.starter), [challenge.starter]);
  const storedActive = storedState?.activeFilePath ?? null;
  const activePath = storedActive !== null && filePaths.includes(storedActive) ? storedActive : (filePaths[0] ?? '');

  const handleFileChange = useCallback(
    (path: string, contents: string): void => {
      filesRef.current = { ...filesRef.current, [path]: contents };
      setFiles(filesRef.current);
      persistDraft(path, contents);
    },
    [persistDraft],
  );

  const handleSelectFile = useCallback(
    (path: string): void => {
      persistDraft.flush();
      setActiveFile(challenge.id, path);
    },
    [challenge.id, persistDraft, setActiveFile],
  );

  // One transpiler session per workspace (Plan 02: "keep one per session for Run/preview").
  const transpilerRef = useRef<TranspilerClient | null>(null);
  const prepare = useCallback((toPrepare: ChallengeFiles, runtime: RuntimeKind): Promise<PrepareResult> => {
    transpilerRef.current ??= new TranspilerClient();
    return transpilerRef.current.prepare(toPrepare, runtime);
  }, []);
  useEffect(
    () => (): void => {
      transpilerRef.current?.dispose();
      transpilerRef.current = null;
    },
    [],
  );

  const environment = useMemo(() => previewEnvironment(reducedMotionPreview), [reducedMotionPreview]);
  const yours = usePreviewFrame({ environment, enabled: true });
  const [targetEnabled, setTargetEnabled] = useState(false);
  const target = usePreviewFrame({ environment, enabled: targetEnabled });
  // The hook returns a fresh object every render; effects and callbacks must depend on the STABLE
  // pieces (the useCallback-wrapped functions and primitive status), never on the whole object —
  // depending on `target` itself would re-fire the mount effect every render.
  //
  // PreviewFrameApi's mount/recreate/clearConsole members are method-shorthand (Task 9's shipped
  // contract, not ours to edit), so destructuring them — `const { mount } = yours` — trips
  // oxlint's type-aware `typescript/unbound-method`. Latest-ref wrappers call through the api
  // object (`ref.current.mount(...)`), which keeps the unbound-method rule happy (a real method
  // call, not a bare reference) while still giving mountYours/recreateYours a stable identity for
  // dependency arrays, exactly like the destructured originals would have had.
  const yoursRef = useRef(yours);
  yoursRef.current = yours;
  const targetRef = useRef(target);
  targetRef.current = target;
  const mountYours = useCallback((payload: MountPayload): void => yoursRef.current.mount(payload), []);
  const recreateYours = useCallback((): void => yoursRef.current.recreate(), []);
  const clearYoursConsole = useCallback((): void => yoursRef.current.clearConsole(), []);
  const mountTarget = useCallback((payload: MountPayload): void => targetRef.current.mount(payload), []);
  const recreateTarget = useCallback((): void => targetRef.current.recreate(), []);
  const targetStatus = target.status;

  const [activeOutputTab, setActiveOutputTab] = useState<OutputTab>('preview');
  const [previewView, setPreviewView] = useState<PreviewView>('yours');
  const [runDiagnostics, setRunDiagnostics] = useState<readonly TranspileDiagnostic[]>([]);

  const submitApi = useSubmit({ challenge, getFiles: () => filesRef.current, prepare });

  const handleRun = useCallback((): void => {
    persistDraft.flush();
    void prepare(filesRef.current, challenge.runtime)
      .then((result) => {
        // promise/always-return: every path returns explicitly, matching the pattern already used
        // in use-preview-frame.ts and use-submit.ts (a behavior-neutral restructure of the brief's
        // literal early-return guard).
        if (!result.ok) {
          setRunDiagnostics(result.diagnostics);
          return undefined;
        }
        setRunDiagnostics([]);
        mountYours(toMountPayload(challenge, result.submission));
        setActiveOutputTab('preview');
        return undefined;
      })
      .catch((error: unknown) => console.error('run failed', error));
  }, [challenge, mountYours, persistDraft, prepare]);

  const handleSubmit = useCallback((): void => {
    persistDraft.flush();
    if (challenge.gradeMode === 'rubric') {
      // Rubric-only: nothing to grade — mount the preview and open the self-check.
      handleRun();
      setTargetEnabled(true);
      setActiveOutputTab('results');
      return;
    }
    submitApi.submit();
    setActiveOutputTab('results');
  }, [challenge.gradeMode, handleRun, persistDraft, submitApi]);

  const handleReset = useCallback((): void => {
    persistDraft.cancel();
    filesRef.current = { ...challenge.starter };
    setFiles(filesRef.current);
    for (const [path, contents] of Object.entries(challenge.starter)) {
      setDraftFile(challenge.id, path, contents);
    }
  }, [challenge, persistDraft, setDraftFile]);

  const handleClear = useCallback((): void => {
    persistDraft.cancel();
    resetChallengeState(challenge.id);
    filesRef.current = { ...challenge.starter };
    setFiles(filesRef.current);
    void recordClear(repo, challenge.id)
      .then(() => invalidateChallengeData(queryClient, challenge.id))
      .catch((error: unknown) => console.error('failed to record clear', error));
  }, [challenge, persistDraft, queryClient, repo, resetChallengeState]);

  // Target preview mounts lazily, on first request, from the reference solution (spec §4:
  // "the target preview is the reference solution, executed").
  useEffect(() => {
    if (!targetEnabled || targetStatus !== 'ready') return;
    void prepare(challenge.solution, challenge.runtime)
      .then((result) => {
        // promise/always-return: an explicit return keeps this callback returning a value on
        // every path, matching the pattern already used in use-preview-frame.ts and use-submit.ts.
        if (result.ok) mountTarget(toMountPayload(challenge, result.submission));
        return undefined;
      })
      .catch((error: unknown) => console.error('target preview failed', error));
  }, [challenge, mountTarget, prepare, targetEnabled, targetStatus]);

  const handlePreviewViewChange = useCallback((view: PreviewView): void => {
    setPreviewView(view);
    if (view !== 'yours') setTargetEnabled(true);
  }, []);

  const handleRecreatePreviews = useCallback((): void => {
    recreateYours();
    if (targetEnabled) recreateTarget();
  }, [recreateTarget, recreateYours, targetEnabled]);

  const diagnostics = submitApi.diagnostics.length > 0 ? submitApi.diagnostics : runDiagnostics;
  const sizes = clampPaneSizes(paneSizes);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>('brief');

  const promptPane = <PromptPane challenge={challenge} />;
  const editorPane = (
    <EditorPane
      challenge={challenge}
      files={files}
      activePath={activePath}
      onSelectFile={handleSelectFile}
      onFileChange={handleFileChange}
      diagnostics={diagnostics}
      running={submitApi.running}
      onRun={handleRun}
      onSubmit={handleSubmit}
      onReset={handleReset}
      onClear={handleClear}
      submitLabel={challenge.gradeMode === 'rubric' ? 'Self-assess' : 'Submit'}
    />
  );
  const outputPane = (
    <OutputPane
      activeTab={activeOutputTab}
      onTabChange={setActiveOutputTab}
      previewView={previewView}
      onPreviewViewChange={handlePreviewViewChange}
      yoursContainerRef={yours.containerRef}
      targetContainerRef={target.containerRef}
      yoursStatus={yours.status}
      targetStatus={targetStatus}
      onRecreatePreviews={handleRecreatePreviews}
      consoleLines={yours.consoleLines}
      onClearConsole={clearYoursConsole}
      results={{
        challenge,
        report: submitApi.report,
        summary: lastRunResult,
        awaitingRubric: submitApi.awaitingRubric,
        onConfirmRubric: submitApi.confirmRubric,
        onRecordRubricFail: submitApi.recordRubricFail,
      }}
    />
  );

  return (
    <section aria-label={`Workspace: ${challenge.title}`} className="h-full min-h-0">
      {isDesktop ? (
        <div
          ref={desktopRef}
          className="grid h-full min-h-0"
          style={{
            gridTemplateColumns: `minmax(0, ${sizes[0]}fr) auto minmax(0, ${sizes[1]}fr) auto minmax(0, ${sizes[2]}fr)`,
          }}
        >
          <div className="border-border min-h-0 overflow-hidden rounded-md border">{promptPane}</div>
          <PaneSplitter
            index={0}
            sizes={sizes}
            onResize={setPaneSizes}
            containerRef={desktopRef}
            label="Resize brief pane"
          />
          <div className="min-h-0 overflow-hidden">{editorPane}</div>
          <PaneSplitter
            index={1}
            sizes={sizes}
            onResize={setPaneSizes}
            containerRef={desktopRef}
            label="Resize editor pane"
          />
          <div className="border-border min-h-0 overflow-hidden rounded-md border">{outputPane}</div>
        </div>
      ) : (
        <Tabs.Root
          value={mobilePane}
          onValueChange={(value) => setMobilePane(parseMobilePane(value))}
          className="flex h-full min-h-0 flex-col"
        >
          <Tabs.List aria-label="Workspace panes" className="border-border grid grid-cols-3 gap-1 border-b pb-1">
            <Tabs.Trigger value="brief" className="data-[state=active]:bg-accent rounded-md px-2 py-1.5 text-sm">
              Brief
            </Tabs.Trigger>
            <Tabs.Trigger value="editor" className="data-[state=active]:bg-accent rounded-md px-2 py-1.5 text-sm">
              Editor
            </Tabs.Trigger>
            <Tabs.Trigger value="output" className="data-[state=active]:bg-accent rounded-md px-2 py-1.5 text-sm">
              Output
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="brief" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
            {promptPane}
          </Tabs.Content>
          <Tabs.Content value="editor" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
            {editorPane}
          </Tabs.Content>
          <Tabs.Content
            value="output"
            forceMount
            inert={mobilePane === 'output' ? undefined : true}
            className={
              mobilePane === 'output'
                ? 'min-h-0 flex-1'
                : 'pointer-events-none absolute -left-[200vw] h-96 w-full overflow-hidden'
            }
          >
            {outputPane}
          </Tabs.Content>
        </Tabs.Root>
      )}
      {/* jsx-a11y/prefer-tag-over-role: <output> carries an implicit "status" role, so the
          explicit role attribute this brief originally wrote on a <p> is replaced by the native
          element rather than disabled — same announcement text, same aria-live behavior. */}
      <output aria-live="polite" className="sr-only">
        {submitApi.announcement}
      </output>
    </section>
  );
}
