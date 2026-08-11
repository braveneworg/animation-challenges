import { describe, expect, test } from 'vitest';

import { DEFAULT_GRADER_TIMEOUT_MS, type Challenge } from '@/challenges/types';
import {
  DEFAULT_ENVIRONMENT,
  parseFrameMessage,
  parseHostMessage,
  PROTOCOL_VERSION,
  toMountPayload,
} from '@/runner/protocol';
import type { PreparedSubmission } from '@/runner/types';
import { prepareRequestSchema, prepareResponseSchema } from '@/runner/worker-protocol';

const submission: PreparedSubmission = {
  modules: [{ path: 'index.ts', code: 'export {};', imports: [] }],
  cssFiles: [{ path: 'styles.css', source: '.x{}' }],
  htmlFile: null,
  entryPath: 'index.ts',
  sources: { 'index.ts': 'export {};', 'styles.css': '.x{}' },
};

describe('host messages', () => {
  test('round-trips every message type', () => {
    const messages = [
      { v: PROTOCOL_VERSION, type: 'setEnvironment', environment: DEFAULT_ENVIRONMENT },
      { v: PROTOCOL_VERSION, type: 'grade', challengeId: 'a/b', timeoutMs: 5000 },
      { v: PROTOCOL_VERSION, type: 'reset' },
      { v: PROTOCOL_VERSION, type: 'replay' },
    ];
    for (const message of messages) expect(parseHostMessage(message)).toEqual(message);
  });

  test('rejects a wrong version, an unknown type, and a malformed grade', () => {
    expect(parseHostMessage({ v: 2, type: 'reset' })).toBeNull();
    expect(parseHostMessage({ v: PROTOCOL_VERSION, type: 'destroy' })).toBeNull();
    expect(parseHostMessage({ v: PROTOCOL_VERSION, type: 'grade', challengeId: 'a/b' })).toBeNull();
    expect(parseHostMessage(null)).toBeNull();
    expect(parseHostMessage('ready')).toBeNull();
  });
});

describe('frame messages', () => {
  test('round-trips ready, console, error, and graded', () => {
    const graded = {
      v: PROTOCOL_VERSION,
      type: 'graded',
      report: {
        challengeId: 'a/b',
        passed: false,
        assertions: [{ ok: false, message: 'm', hint: 'h', actual: '1', expected: '2' }],
        threw: null,
        timedOut: false,
        durationMs: 12,
      },
    };
    expect(parseFrameMessage(graded)).toEqual(graded);
    expect(parseFrameMessage({ v: PROTOCOL_VERSION, type: 'ready' })).toEqual({ v: PROTOCOL_VERSION, type: 'ready' });
    expect(parseFrameMessage({ v: PROTOCOL_VERSION, type: 'console', level: 'warn', text: 'x' })).not.toBeNull();
    expect(
      parseFrameMessage({ v: PROTOCOL_VERSION, type: 'error', scope: 'mount', message: 'boom', stack: null }),
    ).not.toBeNull();
  });

  test('rejects an assertion record missing its hint', () => {
    const graded = {
      v: PROTOCOL_VERSION,
      type: 'graded',
      report: {
        challengeId: 'a/b',
        passed: true,
        assertions: [{ ok: true, message: 'm', actual: null, expected: null }],
        threw: null,
        timedOut: false,
        durationMs: 1,
      },
    };
    expect(parseFrameMessage(graded)).toBeNull();
  });
});

describe('toMountPayload', () => {
  const base: Challenge = {
    id: 'tailwind-basics/demo',
    title: 'Demo',
    categoryId: 'tailwind-basics',
    difficulty: 'novice',
    tech: ['tailwind'],
    runtime: 'dom',
    brief: 'b',
    goals: ['g'],
    starter: { 'index.html': '<p>s</p>' },
    solution: { 'index.html': '<p>t</p>' },
    explanation: 'e',
    gradeMode: 'auto',
    hints: [],
    relatedIds: [],
    estimatedMinutes: 5,
    tags: [],
  };

  test('maps tech to wantsTailwind and copies the submission through', () => {
    const payload = toMountPayload(base, submission);
    expect(payload.wantsTailwind).toBe(true);
    expect(payload.challengeId).toBe('tailwind-basics/demo');
    expect(payload.entryPath).toBe('index.ts');
    expect(toMountPayload({ ...base, tech: ['css'] }, submission).wantsTailwind).toBe(false);
  });
});

describe('worker protocol', () => {
  test('validates a request and both response arms', () => {
    expect(prepareRequestSchema.safeParse({ requestId: 1, files: { 'a.ts': 'x' }, runtime: 'dom' }).success).toBe(true);
    expect(prepareRequestSchema.safeParse({ requestId: 1, files: { 'a.ts': 'x' }, runtime: 'svelte' }).success).toBe(
      false,
    );
    expect(prepareResponseSchema.safeParse({ requestId: 1, result: { ok: true, submission } }).success).toBe(true);
    expect(
      prepareResponseSchema.safeParse({
        requestId: 1,
        result: { ok: false, diagnostics: [{ path: 'a.ts', message: 'bad', line: 1, column: 2 }] },
      }).success,
    ).toBe(true);
  });
});

test('the grader timeout default is encoded once, as 5000ms (spec §4)', () => {
  expect(DEFAULT_GRADER_TIMEOUT_MS).toBe(5000);
});
