import { z } from 'zod';

import { readEnvelope, writeEnvelope } from '@/data/envelope';
import {
  attemptSchema,
  parseWith,
  progressRecordSchema,
  safeParseNote,
  safeParseProfile,
  type Attempt,
  type Note,
  type Profile,
  type ProgressRecord,
} from '@/data/records';
import type { SyncableProgressStore } from '@/data/repository';
import {
  ATTEMPTS_KEY_PREFIX,
  attemptsKey,
  noteKey,
  NOTES_KEY_PREFIX,
  STORAGE_KEYS,
  type KeyValueStorage,
} from '@/data/storage';

export interface LocalRepositoryOptions {
  now?: (() => string) | undefined;
}

export const DEFAULT_PROFILE_NAME = 'Local user';

const progressListSchema = z.array(progressRecordSchema);
const attemptListSchema = z.array(attemptSchema);

export class LocalProgressRepository implements SyncableProgressStore {
  private readonly storage: KeyValueStorage;
  private readonly now: () => string;

  constructor(storage: KeyValueStorage, options: LocalRepositoryOptions = {}) {
    this.storage = storage;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private readProgressList(): ProgressRecord[] {
    return (
      readEnvelope(this.storage.getItem(STORAGE_KEYS.progress), (input) =>
        parseWith<ProgressRecord[]>(progressListSchema, input),
      ) ?? []
    );
  }

  listProgress(): Promise<ProgressRecord[]> {
    return Promise.resolve(this.readProgressList());
  }

  upsertProgress(rec: ProgressRecord): Promise<ProgressRecord> {
    const records = this.readProgressList();
    const index = records.findIndex((candidate) => candidate.id === rec.id);
    if (index === -1) {
      records.push(rec);
    } else {
      records[index] = rec;
    }
    this.storage.setItem(STORAGE_KEYS.progress, writeEnvelope(records));
    return Promise.resolve(rec);
  }

  private readAttemptList(challengeId: string): Attempt[] {
    return (
      readEnvelope(this.storage.getItem(attemptsKey(challengeId)), (input) =>
        parseWith<Attempt[]>(attemptListSchema, input),
      ) ?? []
    );
  }

  listAttempts(challengeId: string): Promise<Attempt[]> {
    return Promise.resolve(this.readAttemptList(challengeId));
  }

  /** Idempotent by attempt id — the mirror pulls remote attempts through this same method. */
  addAttempt(a: Attempt): Promise<Attempt> {
    const attempts = this.readAttemptList(a.challengeId);
    if (!attempts.some((candidate) => candidate.id === a.id)) {
      attempts.push(a);
      this.storage.setItem(attemptsKey(a.challengeId), writeEnvelope(attempts));
    }
    return Promise.resolve(a);
  }

  listAllAttempts(): Promise<Attempt[]> {
    const all: Attempt[] = [];
    for (const key of this.storage.keys()) {
      if (key.startsWith(ATTEMPTS_KEY_PREFIX)) {
        all.push(
          ...(readEnvelope(this.storage.getItem(key), (input) => parseWith<Attempt[]>(attemptListSchema, input)) ?? []),
        );
      }
    }
    all.sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt),
    );
    return Promise.resolve(all);
  }

  getNote(challengeId: string): Promise<Note | null> {
    return Promise.resolve(readEnvelope(this.storage.getItem(noteKey(challengeId)), safeParseNote));
  }

  saveNote(n: Note): Promise<Note> {
    this.storage.setItem(noteKey(n.challengeId), writeEnvelope(n));
    return Promise.resolve(n);
  }

  listNotes(): Promise<Note[]> {
    const notes: Note[] = [];
    for (const key of this.storage.keys()) {
      if (key.startsWith(NOTES_KEY_PREFIX)) {
        const note = readEnvelope(this.storage.getItem(key), safeParseNote);
        if (note !== null) {
          notes.push(note);
        }
      }
    }
    notes.sort((left, right) => left.id.localeCompare(right.id));
    return Promise.resolve(notes);
  }

  getProfile(): Promise<Profile> {
    const existing = readEnvelope(this.storage.getItem(STORAGE_KEYS.profile), safeParseProfile);
    if (existing !== null) {
      return Promise.resolve(existing);
    }
    const created: Profile = { id: 'local', displayName: DEFAULT_PROFILE_NAME, createdAt: this.now() };
    this.storage.setItem(STORAGE_KEYS.profile, writeEnvelope(created));
    return Promise.resolve(created);
  }

  putProfile(profile: Profile): Promise<Profile> {
    this.storage.setItem(STORAGE_KEYS.profile, writeEnvelope(profile));
    return Promise.resolve(profile);
  }
}
