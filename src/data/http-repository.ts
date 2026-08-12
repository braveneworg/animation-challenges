import { z } from 'zod';

import {
  noteShape,
  parseWith,
  progressRecordShape,
  safeParseAttempt,
  safeParseProfile,
  type Attempt,
  type Note,
  type ParseResult,
  type Profile,
  type ProgressRecord,
} from '@/data/records';
import type { SyncableProgressStore } from '@/data/repository';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpRepositoryError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'HttpRepositoryError';
    this.status = status;
  }
}

/**
 * Challenge ids carry exactly one '/', which cannot live in a URL path segment. Both id
 * segments are kebab-case (Plan 01 schema refine), so '__' never occurs naturally and the
 * mapping is injective. On the wire, `id` is encoded; `challengeId` stays real.
 */
export function toResourceId(challengeId: string): string {
  return challengeId.replace('/', '__');
}

export function fromResourceId(resourceId: string): string {
  return resourceId.replace('__', '/');
}

const wireProgressSchema = z.strictObject(progressRecordShape);
const wireNoteSchema = z.strictObject(noteShape);

function normalizeProgress(input: unknown): ParseResult<ProgressRecord> {
  const wire = parseWith(wireProgressSchema, input);
  if (!wire.success) {
    return wire;
  }
  if (fromResourceId(wire.data.id) !== wire.data.challengeId) {
    return {
      success: false,
      issues: [`id '${wire.data.id}' does not decode to challengeId '${wire.data.challengeId}'`],
    };
  }
  return { success: true, data: { ...wire.data, id: wire.data.challengeId } };
}

function normalizeNote(input: unknown): ParseResult<Note> {
  const wire = parseWith(wireNoteSchema, input);
  if (!wire.success) {
    return wire;
  }
  if (fromResourceId(wire.data.id) !== wire.data.challengeId) {
    return {
      success: false,
      issues: [`id '${wire.data.id}' does not decode to challengeId '${wire.data.challengeId}'`],
    };
  }
  return { success: true, data: { ...wire.data, id: wire.data.challengeId } };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class HttpProgressRepository implements SyncableProgressStore {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;

  constructor(baseUrl: string, fetchFn: FetchLike) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.fetchFn = fetchFn;
  }

  private request(path: string, init?: RequestInit): Promise<Response> {
    return this.fetchFn(`${this.baseUrl}${path}`, init);
  }

  private async readBody(response: Response, context: string): Promise<unknown> {
    try {
      const body: unknown = await response.json();
      return body;
    } catch {
      throw new HttpRepositoryError(`${context}: response body is not valid JSON`);
    }
  }

  private async requestJson(path: string, init?: RequestInit): Promise<unknown> {
    const method = init?.method ?? 'GET';
    const response = await this.request(path, init);
    if (!response.ok) {
      throw new HttpRepositoryError(`${method} ${path} failed with status ${response.status}`, response.status);
    }
    return this.readBody(response, `${method} ${path}`);
  }

  private parseList<T>(body: unknown, parseItem: (input: unknown) => ParseResult<T>, label: string): T[] {
    if (!Array.isArray(body)) {
      throw new HttpRepositoryError(`expected an array of ${label}`);
    }
    const items: unknown[] = body;
    return items.map((item) => this.parseSingle(item, parseItem, label));
  }

  private parseSingle<T>(body: unknown, parseItem: (input: unknown) => ParseResult<T>, label: string): T {
    const result = parseItem(body);
    if (!result.success) {
      throw new HttpRepositoryError(`malformed ${label}: ${result.issues.join('; ')}`);
    }
    return result.data;
  }

  /** PUT the encoded resource; on 404 (record not on the server yet) fall back to POST. */
  private async putThenPost<T>(
    collectionPath: string,
    resourceId: string,
    payload: string,
    parseItem: (input: unknown) => ParseResult<T>,
    label: string,
  ): Promise<T> {
    const putPath = `${collectionPath}/${resourceId}`;
    const putResponse = await this.request(putPath, { method: 'PUT', headers: JSON_HEADERS, body: payload });
    if (putResponse.status === 404) {
      const postBody = await this.requestJson(collectionPath, { method: 'POST', headers: JSON_HEADERS, body: payload });
      return this.parseSingle(postBody, parseItem, label);
    }
    if (!putResponse.ok) {
      throw new HttpRepositoryError(`PUT ${putPath} failed with status ${putResponse.status}`, putResponse.status);
    }
    return this.parseSingle(await this.readBody(putResponse, `PUT ${putPath}`), parseItem, label);
  }

  async listProgress(): Promise<ProgressRecord[]> {
    return this.parseList(await this.requestJson('/progress'), normalizeProgress, 'progress record');
  }

  upsertProgress(rec: ProgressRecord): Promise<ProgressRecord> {
    const resourceId = toResourceId(rec.challengeId);
    const payload = JSON.stringify({ ...rec, id: resourceId });
    return this.putThenPost('/progress', resourceId, payload, normalizeProgress, 'progress record');
  }

  async listAttempts(challengeId: string): Promise<Attempt[]> {
    const body = await this.requestJson(`/attempts?challengeId=${encodeURIComponent(challengeId)}`);
    return this.parseList(body, safeParseAttempt, 'attempt');
  }

  async listAllAttempts(): Promise<Attempt[]> {
    return this.parseList(await this.requestJson('/attempts'), safeParseAttempt, 'attempt');
  }

  async addAttempt(a: Attempt): Promise<Attempt> {
    const body = await this.requestJson('/attempts', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(a),
    });
    return this.parseSingle(body, safeParseAttempt, 'attempt');
  }

  async getNote(challengeId: string): Promise<Note | null> {
    const path = `/notes/${toResourceId(challengeId)}`;
    const response = await this.request(path);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new HttpRepositoryError(`GET ${path} failed with status ${response.status}`, response.status);
    }
    return this.parseSingle(await this.readBody(response, `GET ${path}`), normalizeNote, 'note');
  }

  saveNote(n: Note): Promise<Note> {
    const resourceId = toResourceId(n.challengeId);
    const payload = JSON.stringify({ ...n, id: resourceId });
    return this.putThenPost('/notes', resourceId, payload, normalizeNote, 'note');
  }

  async listNotes(): Promise<Note[]> {
    return this.parseList(await this.requestJson('/notes'), normalizeNote, 'note');
  }

  async getProfile(): Promise<Profile> {
    return this.parseSingle(await this.requestJson('/profile'), safeParseProfile, 'profile');
  }

  async putProfile(profile: Profile): Promise<Profile> {
    const body = await this.requestJson('/profile', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(profile),
    });
    return this.parseSingle(body, safeParseProfile, 'profile');
  }
}
