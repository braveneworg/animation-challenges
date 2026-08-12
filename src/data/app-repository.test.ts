import { describe, expect, it } from 'vitest';

import { createAppRepository } from '@/data/app-repository';
import type { FetchLike } from '@/data/http-repository';
import { initialProgressRecord } from '@/data/progress-transitions';
import { MemoryStorage } from '@/data/storage';

const T0 = '2026-08-01T10:00:00.000Z';

interface RecordedCall {
  url: string;
  method: string;
  body: string | null;
}

interface WireRecord {
  id: string;
  [key: string]: unknown;
}

function isWireRecord(value: unknown): value is WireRecord {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
}

/**
 * A minimal, IN-MEMORY, CORRECT REST fake for `/progress`, `/notes`, `/attempts`, and the
 * singular `/profile` — honoring the documented wire protocol HttpProgressRepository speaks
 * (PUT the encoded resource, fall back to POST with the CLIENT-SUPPLIED id on 404). This is
 * deliberately more compliant than the real `json-server` v1 beta binary, which does not
 * honor a client-supplied id on POST (a known upstream bug, out of scope for this repo) — so
 * this fake is the only way to prove the local+http+mirrored composition reaches 'synced'.
 */
function createStatefulFakeServer(): { fetchFn: FetchLike; calls: RecordedCall[]; progress: Map<string, WireRecord> } {
  const progress = new Map<string, WireRecord>();
  const notes = new Map<string, WireRecord>();
  const attempts: WireRecord[] = [];
  let profile: WireRecord | null = null;
  const calls: RecordedCall[] = [];

  function respond(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }

  function collectionFor(name: string): Map<string, WireRecord> | null {
    if (name === 'progress') return progress;
    if (name === 'notes') return notes;
    return null;
  }

  const fetchFn: FetchLike = (input, init) => {
    const method = init?.method ?? 'GET';
    const url = new URL(input);
    const rawBody = typeof init?.body === 'string' ? init.body : null;
    calls.push({ url: input, method, body: rawBody });
    const parsedBody: unknown = rawBody === null ? undefined : JSON.parse(rawBody);
    const body = isWireRecord(parsedBody) ? parsedBody : undefined;

    const itemMatch = /^\/(progress|notes)\/(.+)$/.exec(url.pathname);
    if (itemMatch) {
      const [, name, id] = itemMatch;
      const collection = name === undefined ? null : collectionFor(name);
      if (collection !== null && id !== undefined && method === 'PUT') {
        if (!collection.has(id) || body === undefined) {
          return Promise.resolve(respond(404, {}));
        }
        collection.set(id, body);
        return Promise.resolve(respond(200, body));
      }
    }

    if (url.pathname === '/progress' || url.pathname === '/notes') {
      const collection = collectionFor(url.pathname.slice(1));
      if (collection !== null) {
        if (method === 'GET') return Promise.resolve(respond(200, [...collection.values()]));
        if (method === 'POST' && body !== undefined) {
          // Honors the client-supplied id — this is the exact protocol behavior the real
          // json-server binary is known NOT to provide.
          collection.set(body.id, body);
          return Promise.resolve(respond(201, body));
        }
      }
    }

    if (url.pathname === '/attempts') {
      if (method === 'GET') return Promise.resolve(respond(200, attempts));
      if (method === 'POST' && body !== undefined) {
        attempts.push(body);
        return Promise.resolve(respond(201, body));
      }
    }

    if (url.pathname === '/profile') {
      if (method === 'GET') {
        return profile === null ? Promise.resolve(respond(404, {})) : Promise.resolve(respond(200, profile));
      }
      if (method === 'PUT' && body !== undefined) {
        profile = body;
        return Promise.resolve(respond(200, body));
      }
    }

    return Promise.resolve(respond(500, { error: `unhandled ${method} ${url.pathname}` }));
  };

  return { fetchFn, calls, progress };
}

describe('createAppRepository', () => {
  it('with an empty apiBaseUrl runs local-only and reports sync disabled', async () => {
    const repo = createAppRepository({ apiBaseUrl: '', storage: new MemoryStorage(), now: () => T0 });
    await repo.upsertProgress(initialProgressRecord('a/b', T0));
    await repo.flush();
    expect(await repo.listProgress()).toEqual([initialProgressRecord('a/b', T0)]);
    expect((await repo.sync()).status).toBe('disabled');
  });

  it('with a base URL and an unreachable server degrades to offline, keeping data local', async () => {
    const failingFetch: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'));
    const repo = createAppRepository({
      apiBaseUrl: 'http://localhost:3001',
      storage: new MemoryStorage(),
      fetchFn: failingFetch,
      now: () => T0,
    });
    await repo.upsertProgress(initialProgressRecord('a/b', T0));
    await repo.flush();
    expect(await repo.listProgress()).toEqual([initialProgressRecord('a/b', T0)]);
    expect((await repo.sync()).status).toBe('offline');
  });

  it('reaches a synced status through the local+http+mirrored composition, carrying encoded ids on the wire', async () => {
    // The only executable proof this composition works end to end: the real json-server
    // binary can't provide it (known upstream bug — it ignores a client-supplied id on POST),
    // so this fake stands in as a correctly-behaving server for exactly that one protocol step.
    const server = createStatefulFakeServer();
    const repo = createAppRepository({
      apiBaseUrl: 'http://localhost:3001',
      storage: new MemoryStorage(),
      fetchFn: server.fetchFn,
      now: () => T0,
    });
    const challengeId = 'css-transitions/hover-lift';
    const encodedId = 'css-transitions__hover-lift';

    await repo.upsertProgress(initialProgressRecord(challengeId, T0));
    await repo.flush(); // let the fire-and-forget mirror write land before sync() pulls

    const result = await repo.sync();

    expect(result.status).toBe('synced');
    expect(result.errors).toEqual([]);
    expect(await repo.listProgress()).toEqual([initialProgressRecord(challengeId, T0)]);
    // The wire call carried the ENCODED id, per the documented protocol — never the raw
    // challengeId, which contains a '/' that can't live in a URL path segment.
    expect(server.progress.has(encodedId)).toBe(true);
    expect(
      server.calls.some(
        (call) =>
          call.method === 'POST' && call.url === 'http://localhost:3001/progress' && call.body?.includes(encodedId),
      ),
    ).toBe(true);
    expect(server.calls.some((call) => call.method === 'PUT' && call.url.endsWith(`/progress/${encodedId}`))).toBe(
      true,
    );
  });
});
