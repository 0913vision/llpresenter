import {basename} from 'node:path';
import {expect, it, vi} from 'vitest';
import {loadFolder} from '@main/store/library';
import {loadFile} from '@main/store/readFiles';
import type {LoadedFile} from '@core/schema/fileFormat';

const names = Array.from(
  {length: 17},
  (_, i) => `${String(i).padStart(2, '0')}.llsong`,
);
vi.mock('@main/store/readFiles', () => ({
  listFolder: async () => ({ok: true, value: names}),
  loadFile: vi.fn(),
}));

it('bounds outstanding reads to eight and keeps sorted duplicate precedence despite completion order', async () => {
  const finishers: Array<() => void> = [];
  let active = 0;
  let maximum = 0;
  vi.mocked(loadFile).mockImplementation(async (file, parse) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise<void>(resolve => {
      finishers.push(resolve);
    });
    active--;
    return parse('', file);
  });
  const pending = loadFolder('/songs', '.llsong', (_text, file) => {
    const value: LoadedFile<{id: string; title: string}> = {
      data: {id: 'duplicate', title: basename(file)},
      access: 'editable',
      sourceVersion: 1,
      dropped: [],
    };
    return {ok: true, value};
  });
  for (const count of [8, 8, 1]) {
    await vi.waitFor(() => expect(finishers).toHaveLength(count));
    for (const finish of finishers.splice(0).reverse()) finish();
  }
  const result = await pending;
  expect(maximum).toBe(8);
  expect(result.items.get('duplicate')?.file).toContain('00.llsong');
  expect(result.problems.map(problem => basename(problem.file))).toEqual(
    names.slice(1),
  );
});
