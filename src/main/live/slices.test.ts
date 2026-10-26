import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {isLiveSlice} from './slice';
import {liveSlices} from './slices';

const MODULE_EXTENSION = '.ts';

async function sliceModuleNames(): Promise<readonly string[]> {
  const names = await readdir(join(import.meta.dirname, 'slices'));
  return names
    .filter(
      name => name.endsWith(MODULE_EXTENSION) && !name.endsWith('.test.ts'),
    )
    .map(name => name.slice(0, -MODULE_EXTENSION.length));
}

describe('live slice discovery', () => {
  it('registers every command of every slice module in the folder', async () => {
    const names = await sliceModuleNames();
    const commands: string[] = [];
    for (const name of names) {
      const module: unknown = await import(`./slices/${name}.ts`);
      const slices =
        typeof module === 'object' && module !== null
          ? Object.values(module).filter(isLiveSlice)
          : [];
      commands.push(...slices.flatMap(slice => slice.commands));
    }
    expect(names.length).toBeGreaterThan(0);
    expect(commands.filter(type => !liveSlices.handles(type))).toEqual([]);
  });
});
