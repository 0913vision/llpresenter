import type {Linter} from 'eslint';

/**
 * Rules switched off for spots in existing code that break them, each as
 * narrow as possible. The code's author fixes the spot and deletes the entry.
 */
export const legacyExclusions: readonly Linter.Config[] = [];
