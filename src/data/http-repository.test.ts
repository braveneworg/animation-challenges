import { describe, expect, it } from 'vitest';

import {
  fromResourceId,
  HttpProgressRepository,
  HttpRepositoryError,
  toResourceId,
  type FetchLike,
} from '@/data/http-repository';
import type { Attempt, Note, ProgressRecord } from '@/data/records';

const T0 = '2026-08-01T10:00:00.000Z';

const record: ProgressRecord = {
  id: 'css-transitions/hover-lift',
  challengeId: 'css-transitions/hover-lift',
  status: 'attempted',
  solveQuality: null,
  attempts: 1,
  hintsRevealed: 0,
  lastAttemptAt: T0,
  updatedAt: T0,
};

const wireRecord = { ...record, id: 'css-transitions__hover-lift' };

interface RecordedCall {
  url: string;
  method: string;
  body: string | null;
}

interface FakeResponse {
  status: number;
  jsonBody: unknown;
}

function makeFakeFetch(queue: FakeResponse[]): { fetchFn: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchFn: FetchLike = (input, init) => {
    calls.push({ url: input, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : null });
    const next = queue.shift();
    if (next === undefined) {
      return Promise.reject(new Error('fake fetch queue exhausted'));
    }
    return Promise.resolve(new Response(JSON.stringify(next.jsonBody), { status: next.status }));
  };
  return { fetchFn, calls };
}

async function expectHttpError(promise: Promise<unknown>): Promise<HttpRepositoryError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpRepositoryError) {
      return error;
    }
    throw new Error(`expected HttpRepositoryError, got ${String(error)}`, { cause: error });
  }
  throw new Error('expected the promise to reject');
}

describe('resource id encoding', () => {
  it('round-trips the single slash through double underscore', () => {
    expect(toResourceId('css-transitions/hover-lift')).toBe('css-transitions__hover-lift');
    expect(fromResourceId('css-transitions__hover-lift')).toBe('css-transitions/hover-lift');
  });
});

describe('HttpProgressRepository', () => {
  it('lists progress, normalizing wire ids back to challenge ids', async () => {
    const { fetchFn, calls } = makeFakeFetch([{ status: 200, jsonBody: [wireRecord] }]);
    const repo = new HttpProgressRepository('http://localhost:3001/', fetchFn);
    expect(await repo.listProgress()).toEqual([record]);
    expect(calls[0]?.url).toBe('http://localhost:3001/progress');
  });

  it('throws HttpRepositoryError on a malformed record', async () => {
    const { fetchFn } = makeFakeFetch([{ status: 200, jsonBody: [{ ...wireRecord, status: 'nonsense' }] }]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    const error = await expectHttpError(repo.listProgress());
    expect(error.message).toContain('status');
  });

  it('rejects a wire record whose id does not decode to its challengeId', async () => {
    const { fetchFn } = makeFakeFetch([{ status: 200, jsonBody: [{ ...wireRecord, id: 'other__challenge' }] }]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    const error = await expectHttpError(repo.listProgress());
    expect(error.message).toContain('decode');
  });

  it('throws HttpRepositoryError with the status on a non-ok response', async () => {
    const { fetchFn } = makeFakeFetch([{ status: 500, jsonBody: { error: 'boom' } }]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    const error = await expectHttpError(repo.listProgress());
    expect(error.status).toBe(500);
  });

  it('upserts with PUT to the encoded resource path', async () => {
    const { fetchFn, calls } = makeFakeFetch([{ status: 200, jsonBody: wireRecord }]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    expect(await repo.upsertProgress(record)).toEqual(record);
    expect(calls[0]).toEqual({
      url: 'http://localhost:3001/progress/css-transitions__hover-lift',
      method: 'PUT',
      body: JSON.stringify(wireRecord),
    });
  });

  it('falls back to POST when PUT reports 404 (first write of a record)', async () => {
    const { fetchFn, calls } = makeFakeFetch([
      { status: 404, jsonBody: {} },
      { status: 201, jsonBody: wireRecord },
    ]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    expect(await repo.upsertProgress(record)).toEqual(record);
    expect(calls.map((call) => call.method)).toEqual(['PUT', 'POST']);
    expect(calls[1]?.url).toBe('http://localhost:3001/progress');
  });

  it('filters attempts by challengeId via query string', async () => {
    const attempt: Attempt = {
      id: 'id-1',
      challengeId: 'a/b',
      createdAt: T0,
      passed: true,
      failures: [],
      durationMs: 5,
    };
    const { fetchFn, calls } = makeFakeFetch([{ status: 200, jsonBody: [attempt] }]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    expect(await repo.listAttempts('a/b')).toEqual([attempt]);
    expect(calls[0]?.url).toBe('http://localhost:3001/attempts?challengeId=a%2Fb');
  });

  it('adds attempts via POST', async () => {
    const attempt: Attempt = {
      id: 'id-1',
      challengeId: 'a/b',
      createdAt: T0,
      passed: false,
      failures: [],
      durationMs: 5,
    };
    const { fetchFn, calls } = makeFakeFetch([{ status: 201, jsonBody: attempt }]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    expect(await repo.addAttempt(attempt)).toEqual(attempt);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('http://localhost:3001/attempts');
  });

  it('returns null for a missing note and normalizes an existing one', async () => {
    const note: Note = { id: 'a/b', challengeId: 'a/b', body: 'text', updatedAt: T0 };
    const wireNote = { ...note, id: 'a__b' };
    const missing = makeFakeFetch([{ status: 404, jsonBody: {} }]);
    const repo = new HttpProgressRepository('http://localhost:3001', missing.fetchFn);
    expect(await repo.getNote('a/b')).toBeNull();
    const found = makeFakeFetch([{ status: 200, jsonBody: wireNote }]);
    const repo2 = new HttpProgressRepository('http://localhost:3001', found.fetchFn);
    expect(await repo2.getNote('a/b')).toEqual(note);
    expect(found.calls[0]?.url).toBe('http://localhost:3001/notes/a__b');
  });

  it('reads and writes the singular profile resource', async () => {
    const profile = { id: 'local', displayName: 'Local user', createdAt: T0 };
    const { fetchFn, calls } = makeFakeFetch([
      { status: 200, jsonBody: profile },
      { status: 200, jsonBody: profile },
    ]);
    const repo = new HttpProgressRepository('http://localhost:3001', fetchFn);
    expect(await repo.getProfile()).toEqual(profile);
    expect(await repo.putProfile(profile)).toEqual(profile);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET http://localhost:3001/profile',
      'PUT http://localhost:3001/profile',
    ]);
  });
});
