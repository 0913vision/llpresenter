import {resolve} from 'node:path';
import {ESLint} from 'eslint';
import {getFileInfo} from 'prettier';
import {describe, expect, it} from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const CONFIG = resolve(REPO_ROOT, 'electron.vite.config.ts');
const TEMP_CONFIG = resolve(
  REPO_ROOT,
  'electron.vite.config.ts.1761400000000-8f3a2b1c.mjs',
);
const PRETTIER_IGNORE = resolve(REPO_ROOT, '.prettierignore');

// NOTE(0913vision): Loading the lint plugins took 65 s once when several
// sessions tested at once.
const LOAD_TIMEOUT_MS = 180_000;

describe("electron-vite's temporary config", () => {
  it(
    'is skipped by lint, while the config itself is linted',
    async () => {
      const eslint = new ESLint({cwd: REPO_ROOT});
      expect(await eslint.isPathIgnored(TEMP_CONFIG)).toBe(true);
      expect(await eslint.isPathIgnored(CONFIG)).toBe(false);
    },
    LOAD_TIMEOUT_MS,
  );

  it('is skipped by Prettier, while the config itself is checked', async () => {
    const ignorePath = PRETTIER_IGNORE;
    expect((await getFileInfo(TEMP_CONFIG, {ignorePath})).ignored).toBe(true);
    expect((await getFileInfo(CONFIG, {ignorePath})).ignored).toBe(false);
  });
});
