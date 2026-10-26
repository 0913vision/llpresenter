import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {describe, expect, it} from 'vitest';
import {isLiveSlice} from './slice';
import {liveSlices} from './slices';

const SLICE_FOLDER = join(import.meta.dirname, 'slices');

// NOTE(0913vision): Each module is imported by a file URL built at run time,
// which Vite can't turn into a cached import.meta.glob, so a slice file the
// registry's glob misses fails the check.
async function sliceModuleUrls(): Promise<readonly string[]> {
  const names = await readdir(SLICE_FOLDER);
  return names
    .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map(name => pathToFileURL(join(SLICE_FOLDER, name)).href);
}

describe('live slice discovery', () => {
  it('registers every command of every slice module in the folder', async () => {
    const urls = await sliceModuleUrls();
    const commands: string[] = [];
    for (const url of urls) {
      const module: unknown = await import(url);
      const slices =
        typeof module === 'object' && module !== null
          ? Object.values(module).filter(isLiveSlice)
          : [];
      commands.push(...slices.flatMap(slice => slice.commands));
    }
    expect(urls.length).toBeGreaterThan(0);
    expect(commands.length).toBeGreaterThanOrEqual(urls.length);
    expect(commands.filter(type => !liveSlices.handles(type))).toEqual([]);
  });
});
