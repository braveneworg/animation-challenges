import type { SandboxEnvironment } from '@/runner/protocol';
import type { AssertionDetail } from '@/runner/types';
import type { AssertionLog } from '@/sandbox/assertion-log';
import { SIMULATED_HOVER_CLASS } from '@/sandbox/environment';
import { forEachStep } from '@/sandbox/sequence';
import type { TimeController } from '@/sandbox/time-controller';

export type GradeFunction = (ctx: GradeContext) => Promise<void>;

/**
 * What a grader receives (spec §6.5). Assertions accumulate — `expect` records and returns, never
 * throws. Throw plain Errors only for unrecoverable preconditions. Never string-compare a computed
 * `transform`: use `matrix(el)` and compare components against an epsilon.
 */
export interface GradeContext {
  /** The mounted submission's root. Re-read after `setReducedMotion` — a remount replaces children. */
  readonly root: HTMLElement;
  readonly time: TimeController;
  /** Evaluated entry exports for `runtime: 'module'` challenges; empty otherwise. */
  readonly moduleExports: Readonly<Record<string, unknown>>;
  query(selector: string): Element | null;
  queryAll(selector: string): readonly Element[];
  computed(el: Element, property: string): string;
  /** Sugar: `seek(ms)` then read. Animations stay paused afterwards (settle() resumes). */
  styleAt(el: Element, property: string, ms: number): Promise<string>;
  /** Computed transform as a DOMMatrix; 'none' becomes the identity matrix. */
  matrix(el: Element): DOMMatrix;
  animations(el?: Element): readonly Animation[];
  keyframesOf(animation: Animation): readonly ComputedKeyframe[];
  timingOf(animation: Animation): ComputedEffectTiming;
  cssRules(): readonly CSSRule[];
  hasKeyframesRule(name: string): boolean;
  ruleFor(selectorText: string): CSSStyleRule | null;
  /** Simulated: toggles the `.__ac-hover` marker (selectors were rewritten at mount) + pointer/mouse events. */
  hover(el: Element): Promise<void>;
  unhover(el: Element): Promise<void>;
  click(el: Element): Promise<void>;
  focus(el: Element): Promise<void>;
  /** Points are relative to the element's box at drag start; dispatches pointerdown/move.../up. */
  pointerDrag(el: Element, path: readonly { x: number; y: number }[]): Promise<void>;
  scrollTo(y: number): Promise<void>;
  /** Remounts with the flag flipped (spec §6.3). All previously-held element references go stale. */
  setReducedMotion(value: boolean): Promise<void>;
  /** Original (untranspiled) file text — last resort, for "must not use X" constraints. */
  source(path: string): string;
  expect(condition: boolean, detail: AssertionDetail): boolean;
  expectClose(actual: number, expected: number, epsilon: number, detail: { message: string; hint: string }): boolean;
}

export interface GradeContextDeps {
  win: Window & typeof globalThis;
  doc: Document;
  stage: HTMLElement;
  /** Read per call — a remount installs a fresh controller. */
  time: () => TimeController;
  nativeNextFrame: () => Promise<void>;
  moduleExports: () => Readonly<Record<string, unknown>>;
  sources: Readonly<Record<string, string>>;
  log: AssertionLog;
  environment: () => SandboxEnvironment;
  remount: (environment: SandboxEnvironment) => Promise<void>;
}

function forEachSheetRule(doc: Document, visit: (rule: CSSRule) => void): void {
  const walkRules = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      visit(rule);
      if (rule instanceof CSSGroupingRule) walkRules(rule.cssRules);
      if (rule instanceof CSSKeyframesRule) {
        for (const frame of Array.from(rule.cssRules)) visit(frame);
      }
    }
  };
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      walkRules(sheet.cssRules);
    } catch {
      // inaccessible sheet — skip
    }
  }
}

export function buildGradeContext(deps: GradeContextDeps): GradeContext {
  const computed = (el: Element, property: string): string => deps.win.getComputedStyle(el).getPropertyValue(property);

  const forceReflow = (el: Element): void => {
    void el.getBoundingClientRect().width;
  };

  const pointerInit = (point: { x: number; y: number }, buttons: number): PointerEventInit => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    isPrimary: true,
    clientX: point.x,
    clientY: point.y,
    buttons,
  });

  return {
    get root(): HTMLElement {
      return deps.stage;
    },

    get time(): TimeController {
      return deps.time();
    },

    get moduleExports(): Readonly<Record<string, unknown>> {
      return deps.moduleExports();
    },

    query(selector: string): Element | null {
      return deps.stage.querySelector(selector);
    },

    queryAll(selector: string): readonly Element[] {
      return Array.from(deps.stage.querySelectorAll(selector));
    },

    computed,

    async styleAt(el: Element, property: string, ms: number): Promise<string> {
      await deps.time().seek(ms);
      return computed(el, property);
    },

    matrix(el: Element): DOMMatrix {
      const value = computed(el, 'transform');
      return value === 'none' || value === '' ? new DOMMatrix() : new DOMMatrix(value);
    },

    animations(el?: Element): readonly Animation[] {
      const all = deps.doc.getAnimations();
      if (el === undefined) return all;
      return all.filter((animation) => animation.effect instanceof KeyframeEffect && animation.effect.target === el);
    },

    keyframesOf(animation: Animation): readonly ComputedKeyframe[] {
      return animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [];
    },

    timingOf(animation: Animation): ComputedEffectTiming {
      return animation.effect?.getComputedTiming() ?? {};
    },

    cssRules(): readonly CSSRule[] {
      const rules: CSSRule[] = [];
      forEachSheetRule(deps.doc, (rule) => rules.push(rule));
      return rules;
    },

    hasKeyframesRule(name: string): boolean {
      let found = false;
      forEachSheetRule(deps.doc, (rule) => {
        if (rule instanceof CSSKeyframesRule && rule.name === name) found = true;
      });
      return found;
    },

    ruleFor(selectorText: string): CSSStyleRule | null {
      let match: CSSStyleRule | null = null;
      forEachSheetRule(deps.doc, (rule) => {
        if (match === null && rule instanceof CSSStyleRule && rule.selectorText === selectorText) match = rule;
      });
      return match;
    },

    async hover(el: Element): Promise<void> {
      forceReflow(el);
      el.classList.add(SIMULATED_HOVER_CLASS);
      el.dispatchEvent(new PointerEvent('pointerover', pointerInit({ x: 0, y: 0 }, 0)));
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter'));
      forceReflow(el);
      await deps.nativeNextFrame();
    },

    async unhover(el: Element): Promise<void> {
      el.classList.remove(SIMULATED_HOVER_CLASS);
      el.dispatchEvent(new PointerEvent('pointerout', pointerInit({ x: 0, y: 0 }, 0)));
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseleave'));
      forceReflow(el);
      await deps.nativeNextFrame();
    },

    async click(el: Element): Promise<void> {
      el.dispatchEvent(new PointerEvent('pointerdown', pointerInit({ x: 0, y: 0 }, 1)));
      el.dispatchEvent(new PointerEvent('pointerup', pointerInit({ x: 0, y: 0 }, 0)));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await deps.nativeNextFrame();
    },

    async focus(el: Element): Promise<void> {
      if (el instanceof HTMLElement || el instanceof SVGElement) el.focus();
      await deps.nativeNextFrame();
    },

    async pointerDrag(el: Element, path: readonly { x: number; y: number }[]): Promise<void> {
      const first = path[0];
      if (first === undefined) throw new Error('pointerDrag needs at least one point');
      const rect = el.getBoundingClientRect();
      const absolute = path.map((point) => ({ x: rect.left + point.x, y: rect.top + point.y }));
      const start = absolute[0] ?? { x: rect.left, y: rect.top };
      el.dispatchEvent(new PointerEvent('pointerdown', pointerInit(start, 1)));
      const movePoints = absolute.slice(1);
      await forEachStep(movePoints.length, async (i) => {
        const point = movePoints[i];
        if (point === undefined) return;
        el.dispatchEvent(new PointerEvent('pointermove', pointerInit(point, 1)));
        await deps.nativeNextFrame();
      });
      const last = absolute[absolute.length - 1] ?? start;
      el.dispatchEvent(new PointerEvent('pointerup', pointerInit(last, 0)));
      await deps.nativeNextFrame();
    },

    async scrollTo(y: number): Promise<void> {
      const scroller = deps.doc.scrollingElement;
      if (scroller !== null) scroller.scrollTop = y;
      await deps.nativeNextFrame();
      await deps.nativeNextFrame();
    },

    async setReducedMotion(value: boolean): Promise<void> {
      await deps.remount({ ...deps.environment(), forcedReducedMotion: value });
    },

    source(path: string): string {
      const text = deps.sources[path];
      if (text === undefined) throw new Error(`no submitted file named "${path}"`);
      return text;
    },

    expect(condition: boolean, detail: AssertionDetail): boolean {
      return deps.log.record(condition, detail);
    },

    expectClose(actual: number, expected: number, epsilon: number, detail: { message: string; hint: string }): boolean {
      return deps.log.record(Math.abs(actual - expected) <= epsilon, {
        message: detail.message,
        hint: detail.hint,
        actual: String(actual),
        expected: `${expected} ± ${epsilon}`,
      });
    },
  };
}
