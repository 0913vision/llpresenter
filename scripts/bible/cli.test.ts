import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../test/temp-dir';
import {translationFile} from '@core/bible/testing/testFiles';
import {runBibleConverter} from './cli';

describe('Bible converter command', () => {
  it('prints help and rejects missing or extra paths with distinct exit codes', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(await runBibleConverter(['--help'])).toBe(0);
    expect(info).toHaveBeenCalledOnce();
    for (const args of [[], ['one'], ['one', 'two', 'three'], ['', 'two']]) {
      expect(await runBibleConverter(args)).toBe(2);
    }
    expect(error).toHaveBeenCalledTimes(4);
  });

  it('converts invented input and returns a failure code for invalid input', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const folder = await makeTempDir();
    const source = join(folder, 'source.llbible');
    const destination = join(folder, 'new', 'destination.llbible');
    await writeFile(source, JSON.stringify(translationFile([57])));
    expect(await runBibleConverter([source, destination])).toBe(0);
    expect(await runBibleConverter([source, source])).toBe(1);
    expect(error).toHaveBeenCalledOnce();
  });
});
