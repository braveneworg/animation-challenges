/**
 * `String(value)` itself throws for a value with a poisoned `toString` (a hostile getter can reach
 * here via user code), so every stringification of untrusted values goes through this.
 */
export function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unstringifiable value]';
  }
}
