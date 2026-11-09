import {beforeEach, expect, it, vi} from 'vitest';
import {fontFamilyFixture} from '@fixtures/core/fontCatalog';
import {readCatalogFile, writeCatalogFile} from '@main/fonts/catalogFile';

const disk = vi.hoisted(() => ({read: vi.fn(), stat: vi.fn(), write: vi.fn()}));
vi.mock('node:fs/promises', () => ({readFile: disk.read, stat: disk.stat}));
vi.mock('@main/store/atomicWrite', () => ({writeFileAtomically: disk.write}));
const saved = {stamp: 'a'.repeat(64), families: [fontFamilyFixture()]};
beforeEach(() => {
  vi.clearAllMocks();
  disk.stat.mockResolvedValue({size: 100});
});

it('loads validated persisted metadata and writes through the atomic writer', async () => {
  disk.read.mockResolvedValue(JSON.stringify({version: 1, ...saved}));
  expect(await readCatalogFile('cache')).toEqual(saved);
  disk.write.mockResolvedValue({ok: true});
  await writeCatalogFile('cache', saved);
  expect(disk.write).toHaveBeenCalledWith(
    'cache',
    JSON.stringify({version: 1, ...saved}),
  );
  disk.write.mockResolvedValue({ok: false, error: {message: 'busy'}});
  await expect(writeCatalogFile('cache', saved)).rejects.toThrow('busy');
});

it('treats a missing cache as absent, rejects oversized files before reading', async () => {
  disk.stat.mockRejectedValueOnce(
    Object.assign(Error('missing'), {code: 'ENOENT'}),
  );
  expect(await readCatalogFile('cache')).toBeNull();
  disk.stat.mockResolvedValue({size: 2 * 1024 * 1024 + 1});
  await expect(readCatalogFile('cache')).rejects.toThrow('large');
  expect(disk.read).not.toHaveBeenCalled();
});

it.each([
  '{',
  'null',
  JSON.stringify({...saved, version: 2}),
  JSON.stringify({...saved, version: 1, stamp: 'bad'}),
  JSON.stringify({...saved, version: 1, families: [{weights: []}]}),
])('rejects malformed cache data: %s', async value => {
  disk.read.mockResolvedValue(value);
  await expect(readCatalogFile('cache')).rejects.toThrow();
});
