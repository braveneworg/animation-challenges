import { HttpProgressRepository, type FetchLike } from '@/data/http-repository';
import { LocalProgressRepository } from '@/data/local-repository';
import { MirroredProgressRepository } from '@/data/mirrored-repository';
import { createBrowserStorage, type KeyValueStorage } from '@/data/storage';

export interface AppRepositoryOptions {
  /** '' disables the mirror: sync() reports 'disabled'; the app is local-only (spec §3.4). */
  apiBaseUrl: string;
  storage?: KeyValueStorage | undefined;
  fetchFn?: FetchLike | undefined;
  now?: (() => string) | undefined;
}

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * The one factory Plan 05 instantiates. Defaults bind the real browser environment;
 * every default is injectable, which is how the node tests cover this file.
 */
export function createAppRepository(options: AppRepositoryOptions): MirroredProgressRepository {
  const storage = options.storage ?? createBrowserStorage();
  const now = options.now ?? ((): string => new Date().toISOString());
  const local = new LocalProgressRepository(storage, { now });
  const remote =
    options.apiBaseUrl === '' ? null : new HttpProgressRepository(options.apiBaseUrl, options.fetchFn ?? defaultFetch);
  return new MirroredProgressRepository({ local, remote, storage });
}
