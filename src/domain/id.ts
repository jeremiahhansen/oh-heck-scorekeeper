/**
 * Stable ids for players and games.
 *
 * crypto.randomUUID() only exists in a secure context, which rules it out when
 * testing over a plain-http LAN address on a phone, so fall back to a
 * good-enough random string. These ids never leave the device.
 */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
