/**
 * Writes diagnostic values when the `DEBUG` environment variable is set.
 *
 * The function writes no output when `DEBUG` is empty or undefined.
 *
 * @param args These values are passed to `console.log`.
 */
export function debugLog(...args: unknown[]): void {
  if (process.env.DEBUG) {
    console.log(...args);
  }
}
