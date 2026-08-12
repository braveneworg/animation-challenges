import type { Attempt, Note, Profile, ProgressRecord } from '@/data/records';

export interface ProgressRepository {
  listProgress(): Promise<ProgressRecord[]>;
  upsertProgress(rec: ProgressRecord): Promise<ProgressRecord>;
  listAttempts(challengeId: string): Promise<Attempt[]>;
  addAttempt(a: Attempt): Promise<Attempt>;
  getNote(challengeId: string): Promise<Note | null>;
  saveNote(n: Note): Promise<Note>;
  getProfile(): Promise<Profile>;
}

/**
 * What MirroredProgressRepository needs from each side to run a full sync. Both concrete
 * repositories implement it; the spec's ProgressRepository stays exactly as written.
 */
export interface SyncableProgressStore extends ProgressRepository {
  listAllAttempts(): Promise<Attempt[]>;
  listNotes(): Promise<Note[]>;
  putProfile(profile: Profile): Promise<Profile>;
}
