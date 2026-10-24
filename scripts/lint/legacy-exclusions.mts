import type {Linter} from 'eslint';

/**
 * Rules switched off for spots in existing code that break them, each as
 * narrow as possible. The code's author fixes the spot and deletes the entry.
 */
export const legacyExclusions: readonly Linter.Config[] = [
  {
    // TODO(0913vision): readStdin casts JSON.parse output with `as`. Validate
    // it instead, then delete this entry.
    files: ['scripts/session-context.ts'],
    rules: {'@typescript-eslint/consistent-type-assertions': 'off'},
  },
  {
    // TODO(0913vision): formatDetail calls String() on an unknown value that
    // JSON.stringify rejected. Handle that case explicitly, then delete this
    // entry.
    files: ['src/main/log.ts'],
    rules: {'@typescript-eslint/no-base-to-string': 'off'},
  },
];
