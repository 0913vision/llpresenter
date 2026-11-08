import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {initialPictures} from '@main/store/initialPictures';
import {makeTempDir} from '@fixtures/tempDir';

it('copies bundled pictures as ordinary relative image entries without overwriting a library file', async () => {
  const folder = await makeTempDir();
  const source = join(folder, 'source.png');
  const id = createMediaId('00000000-0000-4000-8000-000000000381');
  await writeFile(source, 'bundled picture');
  await writeFile(join(folder, `${id}.png`), 'existing picture');
  const items = await initialPictures(folder, [
    {id, name: 'Scripture', file: source},
  ]);
  expect(items).toEqual([
    {
      id,
      name: 'Scripture',
      file: `${id} (2).png`,
      kind: 'image',
      size: 15,
      width: 1920,
      height: 1080,
    },
  ]);
  expect(await readFile(join(folder, `${id}.png`), 'utf8')).toBe(
    'existing picture',
  );
  expect(await readFile(join(folder, items[0]?.file ?? ''), 'utf8')).toBe(
    'bundled picture',
  );
});
