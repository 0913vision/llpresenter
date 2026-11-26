import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {HELD_FOLDER_NAME, HeldDeletions} from '@main/store/files/heldDeletions';

async function setup(refuse = false): Promise<{
  folder: string;
  file: string;
  trashed: string[];
  held: HeldDeletions;
  log: ReturnType<typeof recordingLogger>;
}> {
  const folder = await makeTempDir();
  const file = join(folder, 'song.llsong');
  await writeFile(file, 'deleted song');
  const trashed: string[] = [];
  const log = recordingLogger();
  const trash = vi.fn(async (path: string) => {
    if (refuse) throw new Error('Recycle Bin unavailable');
    trashed.push(`${path} = ${await readFile(path, 'utf8')}`);
    await rm(path);
  });
  return {folder, file, trashed, log, held: new HeldDeletions({trash, log})};
}

it('moves a deleted file aside at once, and puts it back on 실행 취소', async () => {
  const {folder, file, held, trashed} = await setup();
  await held.hold(file);
  expect(await readdir(folder)).toEqual([HELD_FOLDER_NAME]);
  await held.restore(file);
  expect(await readFile(file, 'utf8')).toBe('deleted song');
  expect(await readdir(folder)).toEqual(['song.llsong']);
  await held.discard();
  expect(trashed).toEqual([]);
});

it('sends a held file to the 휴지통 from where it was deleted when the app closes', async () => {
  const {folder, file, held, trashed} = await setup();
  await held.hold(file);
  await held.discard();
  expect(trashed).toEqual([`${file} = deleted song`]);
  expect(await readdir(folder)).toEqual([]);
});

it('keeps a file the 휴지통 refuses held, out of its folder, for the next launch to send', async () => {
  const {folder, file, held, log} = await setup(true);
  await held.hold(file);
  await held.discard();
  expect(await readdir(folder)).toEqual([HELD_FOLDER_NAME]);
  expect(log.messages('warn')).toContain(
    'could not send a deleted file to the 휴지통',
  );
});

it('sends what a run that did not close left in .deleted to the 휴지통 at the next launch', async () => {
  const {folder, file, held, trashed} = await setup();
  const left = join(folder, HELD_FOLDER_NAME, 'earlier-run');
  await mkdir(left, {recursive: true});
  await rename(file, join(left, 'song.llsong'));
  await held.sweep([folder, join(folder, 'missing')]);
  expect(trashed).toEqual([`${file} = deleted song`]);
  expect(await readdir(folder)).toEqual([]);
});

it('leaves a file it can not move aside in place, and sends it from there when the app closes', async () => {
  const {folder, file, held, trashed, log} = await setup();
  await writeFile(join(folder, HELD_FOLDER_NAME), 'not a folder');
  await held.hold(file);
  expect(log.messages('warn')).toContain('could not move a deleted file aside');
  await held.restore(file);
  expect(await readFile(file, 'utf8')).toBe('deleted song');
  await held.hold(file);
  await held.discard();
  expect(trashed).toEqual([`${file} = deleted song`]);
});

it('leaves a deleted file that is already gone alone', async () => {
  const {folder, held, trashed} = await setup();
  await held.hold(join(folder, 'gone.llsong'));
  await held.discard();
  expect(trashed).toEqual([]);
});
