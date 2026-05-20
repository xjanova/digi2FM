/**
 * Debug logging gated by the user's "Debug Mode" setting.
 *
 * The setting is held in SettingsContext, but we expose a module-level
 * flag so non-React code (audio/protocol layers) can use it without
 * threading the setting through every constructor. SettingsContext calls
 * setDebugEnabled() whenever settings.debugMode changes.
 */
let enabled = false;

export function setDebugEnabled(value: boolean): void {
  enabled = value;
}

export function isDebugEnabled(): boolean {
  return enabled;
}

export function debugLog(...args: unknown[]): void {
  if (enabled) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (enabled) console.warn(...args);
}
