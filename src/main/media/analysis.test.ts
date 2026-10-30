import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {createMediaId} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import {startMediaAnalysis} from './analysis';
import type {ThumbnailSource} from './thumbnails';

const ID = createMediaId('00000000-0000-4000-8000-000000000001');
const FILE = 'D:/media/dawn.png';

const source: ThumbnailSource = {
  get: () =>
    expectSuccess(
      parseMediaDocument({
        name: 'media',
        revision: 1,
        access: 'editable',
        value: {
          ...EMPTY_MEDIA_LIST,
          items: [{id: ID, name: 'Dawn', kind: 'image', file: FILE, size: 1}],
        },
      }),
    ),
  fileOf: () => FILE,
  subscribe: () => () => undefined,
};

describe('media analysis', () => {
  it('keeps an import thumbnail where the media scheme finds it, and lends nothing unasked', async () => {
    const folder = join(await makeTempDir(), 'thumbnails');
    const analysis = startMediaAnalysis({
      media: Promise.resolve(source),
      thumbnailFolder: folder,
      log: recordingLogger(),
    });
    const jpeg = Uint8Array.from([0xff, 0xd8]);
    await analysis.saveThumbnail(ID, jpeg, FILE);
    const file = await analysis.thumbnailOf(ID);
    expect(file).toBe(join(folder, `${ID}.jpg`));
    expect(new Uint8Array(await readFile(file ?? ''))).toEqual(jpeg);
    expect(analysis.lentFile('unknown')).toBeNull();
    analysis.dispose();
    expect(await analysis.thumbnailOf(ID)).toBeNull();
  });
});
