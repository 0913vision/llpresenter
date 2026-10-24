import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {mediaUrl} from '@shared/media';
import {makeTempDir} from '../../../test/temp-dir';
import {recordingLogger} from '../displays/testing';
import {
  createFileResponse,
  createMediaHandler,
  parseRange,
} from './mediaResponse';

const CONTENT = '0123456789';

async function sampleVideo(): Promise<string> {
  const path = join(await makeTempDir(), 'warm-light.mp4');
  await writeFile(path, CONTENT);
  return path;
}

describe('parseRange', () => {
  it.each([
    ['bytes=0-3', {start: 0, end: 3}],
    ['bytes=4-', {start: 4, end: 9}],
    ['bytes=-3', {start: 7, end: 9}],
    ['bytes=5-99', {start: 5, end: 9}],
    ['bytes=-99', {start: 0, end: 9}],
  ])('reads %s', (header, range) => {
    expect(parseRange(header, CONTENT.length)).toEqual(range);
  });

  it.each([null, 'bytes=0-1,4-5', 'items=0-3', 'bytes=-'])(
    'sends the whole file for %s',
    header => {
      expect(parseRange(header, CONTENT.length)).toBeNull();
    },
  );

  it.each(['bytes=10-', 'bytes=5-2', 'bytes=-0'])(
    'refuses %s outside the file',
    header => {
      expect(parseRange(header, CONTENT.length)).toBe('unsatisfiable');
    },
  );
});

describe('createFileResponse', () => {
  it('sends the whole file with its type when no range is asked for', async () => {
    const response = await createFileResponse(await sampleVideo(), null);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(await response.text()).toBe(CONTENT);
  });

  it('sends the asked part with its position', async () => {
    const response = await createFileResponse(await sampleVideo(), 'bytes=2-5');
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(response.headers.get('content-length')).toBe('4');
    expect(await response.text()).toBe('2345');
  });

  it('refuses a range past the end', async () => {
    const response = await createFileResponse(await sampleVideo(), 'bytes=20-');
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */10');
  });
});

describe('createMediaHandler', () => {
  it('serves the file of a media id', async () => {
    const path = await sampleVideo();
    const handle = createMediaHandler({
      resolvePath: async mediaId => (mediaId === 'warm light' ? path : null),
      log: recordingLogger(),
    });
    const response = await handle(new Request(mediaUrl('warm light')));
    expect(await response.text()).toBe(CONTENT);
  });

  it('answers 404 and logs an unknown id or a missing file', async () => {
    const log = recordingLogger();
    const missing = join(await makeTempDir(), 'gone.mp4');
    const handle = createMediaHandler({
      resolvePath: async mediaId => (mediaId === 'gone' ? missing : null),
      log,
    });
    expect((await handle(new Request(mediaUrl('unknown')))).status).toBe(404);
    expect((await handle(new Request(mediaUrl('gone')))).status).toBe(404);
    expect(log.messages('warn')).toEqual([
      'no file for a media id',
      'could not serve the media file of gone',
    ]);
  });

  it('answers 400 for a URL that is not a media URL', async () => {
    const handle = createMediaHandler({
      resolvePath: async () => null,
      log: recordingLogger(),
    });
    const response = await handle(new Request('llp-media://other/x'));
    expect(response.status).toBe(400);
  });
});
