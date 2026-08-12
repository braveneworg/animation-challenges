export interface Timestamped {
  id: string;
  updatedAt: string;
}

export interface ReconcilePlan<T extends Timestamped> {
  merged: T[];
  toPush: T[];
  toWriteLocal: T[];
}

export interface Identified {
  id: string;
}

export interface UnionPlan<T extends Identified> {
  merged: T[];
  toPush: T[];
  toWriteLocal: T[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON-stringify with recursively sorted keys, so structurally equal objects compare equal. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    return `[${items.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? '"undefined"';
}

/**
 * Spec §7.2's one reconciliation rule, made total. localStorage is the read source of
 * truth; HTTP is a mirror. Dirty ids are unacknowledged local writes and always push.
 * Otherwise newest updatedAt wins; ties (including unparseable timestamps, since every
 * NaN comparison is false) resolve to local, pushing only when contents actually differ.
 * Precondition: `id` is unique within `local` and unique within `remote` (each side is
 * keyed by id internally) — a repeated id on either side is not deduplicated and produces
 * undefined/incorrect reconciliation for that id.
 */
export function reconcileByUpdatedAt<T extends Timestamped>(
  local: readonly T[],
  remote: readonly T[],
  dirtyIds: ReadonlySet<string>,
): ReconcilePlan<T> {
  const remoteById = new Map(remote.map((record) => [record.id, record]));
  const merged: T[] = [];
  const toPush: T[] = [];
  const toWriteLocal: T[] = [];

  for (const localRecord of local) {
    const remoteRecord = remoteById.get(localRecord.id);
    remoteById.delete(localRecord.id);
    if (remoteRecord === undefined) {
      merged.push(localRecord);
      toPush.push(localRecord);
      continue;
    }
    if (dirtyIds.has(localRecord.id)) {
      merged.push(localRecord);
      toPush.push(localRecord);
      continue;
    }
    const localTime = Date.parse(localRecord.updatedAt);
    const remoteTime = Date.parse(remoteRecord.updatedAt);
    if (remoteTime > localTime) {
      merged.push(remoteRecord);
      toWriteLocal.push(remoteRecord);
      continue;
    }
    if (localTime > remoteTime) {
      merged.push(localRecord);
      toPush.push(localRecord);
      continue;
    }
    merged.push(localRecord);
    if (stableStringify(localRecord) !== stableStringify(remoteRecord)) {
      toPush.push(localRecord);
    }
  }

  for (const remoteRecord of remoteById.values()) {
    merged.push(remoteRecord);
    toWriteLocal.push(remoteRecord);
  }

  merged.sort((left, right) => left.id.localeCompare(right.id));
  return { merged, toPush, toWriteLocal };
}

/**
 * Append-only sets (attempts): union by id; on an id collision the local copy stands.
 * Precondition: `id` is unique within `local` and unique within `remote` — a repeated id
 * on either side is not deduplicated; every copy passes through independently.
 */
export function unionById<T extends Identified>(local: readonly T[], remote: readonly T[]): UnionPlan<T> {
  const localIds = new Set(local.map((item) => item.id));
  const remoteIds = new Set(remote.map((item) => item.id));
  const toPush = local.filter((item) => !remoteIds.has(item.id));
  const toWriteLocal = remote.filter((item) => !localIds.has(item.id));
  const merged: T[] = [...local, ...toWriteLocal];
  merged.sort((left, right) => left.id.localeCompare(right.id));
  return { merged, toPush, toWriteLocal };
}
