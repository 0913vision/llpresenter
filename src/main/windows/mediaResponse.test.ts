import {createReadStream} from 'node:fs';
import {symlink, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {analysisUrl, mediaUrl} from '@shared/media';
import {makeTempDir} from '../../../test/temp-dir';
import {recordingLogger} from '../displays/testing';
import {
  createFileResponse,
  createMediaHandler,
  parseRange,
} from './mediaResponse';

vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return {...fs, createReadStream: vi.fn(fs.createReadStream)};
});

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

  it('destroys a partially read range and closes its file on body cancellation', async () => {
    const path = join(await makeTempDir(), 'large.mp4');
    const size = 2 * 1024 * 1024;
    await writeFile(path, Buffer.alloc(size));
    const response = await createFileResponse(path, 'bytes=0-');
    const result = vi.mocked(createReadStream).mock.results.at(-1);
    if (result?.type !== 'return' || response.body === null) {
      throw new Error('no media stream was created');
    }
    const stream = result.value;
    const reader = response.body.getReader();
    try {
      await reader.read();
      expect(stream.bytesRead).toBeLessThan(size);
      expect(stream.closed).toBe(false);
      const closed = new Promise<void>(resolve =>
        stream.once('close', resolve),
      );
      await reader.cancel();
      expect(stream.destroyed).toBe(true);
      await closed;
      expect(stream.closed).toBe(true);
      expect(stream).toHaveProperty('fd', null);
    } finally {
      await reader.cancel();
      reader.releaseLock();
      stream.destroy();
    }
  });
});

describe('createMediaHandler', () => {
  async function libraryWith(file: string): Promise<{root: string}> {
    const root = await makeTempDir();
    await writeFile(join(root, file), CONTENT);
    return {root};
  }

  it('serves the file of a media id from a media folder', async () => {
    const {root} = await libraryWith('warm-light.mp4');
    const handle = createMediaHandler({
      resolvePath: async mediaId =>
        mediaId === 'warm light' ? join(root, 'warm-light.mp4') : null,
      mediaRoots: () => [root],
      log: recordingLogger(),
    });
    const response = await handle(new Request(mediaUrl('warm light')));
    expect(await response.text()).toBe(CONTENT);
  });

  it('answers 404 and logs an unknown id or a missing file', async () => {
    const log = recordingLogger();
    const root = await makeTempDir();
    const handle = createMediaHandler({
      resolvePath: async mediaId =>
        mediaId === 'gone' ? join(root, 'gone.mp4') : null,
      mediaRoots: () => [root],
      log,
    });
    expect((await handle(new Request(mediaUrl('unknown')))).status).toBe(404);
    expect((await handle(new Request(mediaUrl('gone')))).status).toBe(404);
    expect(log.messages('warn')).toEqual([
      'no file for a media id',
      'no media file inside the media folders for a media id',
    ]);
  });

  it('refuses an encoded path that climbs out of the media folder', async () => {
    const outside = await makeTempDir();
    await writeFile(join(outside, 'secret.txt'), 'private');
    const {root} = await libraryWith('warm-light.mp4');
    const naive = createMediaHandler({
      resolvePath: async mediaId => join(root, mediaId),
      mediaRoots: () => [root],
      log: recordingLogger(),
    });
    const climb = relative(root, join(outside, 'secret.txt'));
    const response = await naive(new Request(mediaUrl(climb)));
    expect(response.status).toBe(404);
  });

  it('refuses a file reached through a link out of the media folder', async () => {
    const outside = await makeTempDir();
    await writeFile(join(outside, 'secret.mp4'), 'private');
    const {root} = await libraryWith('warm-light.mp4');
    await symlink(outside, join(root, 'linked'), 'junction');
    const handle = createMediaHandler({
      resolvePath: async () => join(root, 'linked', 'secret.mp4'),
      mediaRoots: () => [root],
      log: recordingLogger(),
    });
    const response = await handle(new Request(mediaUrl('linked')));
    expect(response.status).toBe(404);
  });

  it('serves a file lent for analysis with CORS, from any folder', async () => {
    const outside = await makeTempDir();
    await writeFile(join(outside, 'lent.mp4'), CONTENT);
    const log = recordingLogger();
    const handle = createMediaHandler({
      resolvePath: async () => null,
      mediaRoots: () => [],
      analysisFile: token =>
        token === 'lent' ? join(outside, 'lent.mp4') : null,
      log,
    });
    const response = await handle(
      new Request(analysisUrl('lent'), {headers: {Range: 'bytes=0-3'}}),
    );
    expect(response.status).toBe(206);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.text()).toBe('0123');
    const past = await handle(
      new Request(analysisUrl('lent'), {headers: {Range: 'bytes=99-'}}),
    );
    expect(past.status).toBe(416);
    expect(past.headers.get('access-control-allow-origin')).toBe('*');
    expect((await handle(new Request(analysisUrl('other')))).status).toBe(404);
    expect(
      (
        await createMediaHandler({
          resolvePath: async () => null,
          mediaRoots: () => [],
          log,
        })(new Request(analysisUrl('lent')))
      ).status,
    ).toBe(404);
    expect(log.messages('warn')).toEqual([
      'no file for an analysis token',
      'no file for an analysis token',
    ]);
  });

  it('answers 404 and logs a lent file that is gone', async () => {
    const gone = join(await makeTempDir(), 'gone.mp4');
    const log = recordingLogger();
    const handle = createMediaHandler({
      resolvePath: async () => null,
      mediaRoots: () => [],
      analysisFile: () => gone,
      log,
    });
    expect((await handle(new Request(analysisUrl('lent')))).status).toBe(404);
    expect(log.messages('warn')).toEqual([
      'could not serve a file for analysis',
    ]);
  });

  it('answers 400 for a URL that is not a media URL', async () => {
    const handle = createMediaHandler({
      resolvePath: async () => null,
      mediaRoots: () => [],
      log: recordingLogger(),
    });
    const response = await handle(new Request('llp-media://other/x'));
    expect(response.status).toBe(400);
  });
});
