/**
 * Strip undefined properties from an object so JSON payloads only
 * include keys the caller explicitly set. Useful for PATCH bodies
 * and query-string maps where `undefined` would otherwise serialise
 * as `null` or "undefined".
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}
