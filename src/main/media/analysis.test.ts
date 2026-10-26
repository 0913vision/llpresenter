import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {createMediaId} from '@shared/schema/ids';
import {recordingLogger} from '../displays/testing';
import {startMediaAnalysis} from './analysis';

const ID = createMediaId('00000000-0000-4000-8000-000000000001');

describe('media analysis', () => {
  it('keeps an import thumbnail where the media scheme finds it, and lends nothing unasked', async () => {
    const folder = join(await makeTempDir(), 'thumbnails');
    const analysis = startMediaAnalysis({
      media: Promise.resolve(null),
      thumbnailFolder: folder,
      log: recordingLogger(),
    });
    const jpeg = Uint8Array.from([0xff, 0xd8]);
    await analysis.saveThumbnail(ID, jpeg);
    const file = await analysis.thumbnailOf(ID);
    expect(file).toBe(join(folder, `${ID}.jpg`));
    expect(new Uint8Array(await readFile(file ?? ''))).toEqual(jpeg);
    expect(analysis.lentFile('unknown')).toBeNull();
    analysis.dispose();
    expect(await analysis.thumbnailOf(ID)).toBeNull();
  });
});
