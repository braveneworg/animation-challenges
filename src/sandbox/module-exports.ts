/** Module-namespace → plain record. The namespace object is exotic; graders get an ordinary record. */
export function toExportsRecord(namespace: unknown): Readonly<Record<string, unknown>> {
  if (typeof namespace !== 'object' || namespace === null) return {};
  const record: Record<string, unknown> = {};
  for (const key of Object.keys(namespace)) {
    record[key] = Reflect.get(namespace, key);
  }
  return record;
}
