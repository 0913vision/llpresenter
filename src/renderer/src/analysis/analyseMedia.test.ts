import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  MAX_ANALYSIS_MESSAGE_LENGTH,
  type AnalysisJob,
} from '@shared/schema/mediaAnalysis';
import {
  THUMBNAIL_FRAME_SECONDS,
  analyseMedia,
  drawOnCanvas,
  type AnalysisDom,
} from './analyseMedia';

const THUMBNAIL = 'data:image/jpeg;base64,AAAA';
const SIZE = {width: 320, height: 180};
const URL = 'llp-media://analysis/invented';

const seeks: number[] = [];

beforeEach(() => {
  seeks.length = 0;
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation(
    (value: number) => {
      seeks.push(value);
    },
  );
});

function define(target: object, values: Readonly<Record<string, unknown>>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(target, key, {value});
  }
}

function fakeDom() {
  const videos: HTMLVideoElement[] = [];
  const audios: HTMLAudioElement[] = [];
  const images: HTMLImageElement[] = [];
  const drawThumbnail = vi.fn<AnalysisDom['drawThumbnail']>(() => THUMBNAIL);
  const dom: AnalysisDom = {
    createVideo: () => {
      const video = document.createElement('video');
      videos.push(video);
      return video;
    },
    createAudio: () => {
      const audio = document.createElement('audio');
      audios.push(audio);
      return audio;
    },
    createImage: () => {
      const image = document.createElement('img');
      images.push(image);
      return image;
    },
    drawThumbnail,
  };
  return {dom, videos, audios, images, drawThumbnail};
}

function job(kind: AnalysisJob['kind'], thumbnail = true): AnalysisJob {
  return {url: URL, kind, thumbnail: thumbnail ? SIZE : null};
}

function fire(target: EventTarget | undefined, event: string): void {
  target?.dispatchEvent(new Event(event));
}

describe('media analysis page', () => {
  it('reads a video and draws its thumbnail one second in', async () => {
    const {dom, videos, drawThumbnail} = fakeDom();
    const reply = analyseMedia(job('video'), dom);
    const video = videos[0];
    expect(video?.getAttribute('src')).toBe(URL);
    expect(video?.crossOrigin).toBe('anonymous');
    define(video ?? {}, {duration: 12, videoWidth: 1920, videoHeight: 1080});
    fire(video, 'loadedmetadata');
    await vi.waitFor(() => expect(seeks).toEqual([THUMBNAIL_FRAME_SECONDS]));
    fire(video, 'seeked');

    expect(await reply).toEqual({
      ok: true,
      duration: 12,
      width: 1920,
      height: 1080,
      thumbnail: THUMBNAIL,
    });
    expect(drawThumbnail).toHaveBeenCalledExactlyOnceWith(
      video,
      {x: 0, y: 0, width: 1920, height: 1080},
      SIZE,
    );
    expect(video?.hasAttribute('src')).toBe(false);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });

  it('takes a short video thumbnail half way through', async () => {
    const {dom, videos} = fakeDom();
    const reply = analyseMedia(job('video'), dom);
    define(videos[0] ?? {}, {duration: 1, videoWidth: 640, videoHeight: 360});
    fire(videos[0], 'loadedmetadata');
    await vi.waitFor(() => expect(seeks).toEqual([0.5]));
    fire(videos[0], 'seeked');
    expect(await reply).toMatchObject({ok: true, duration: 1});
  });

  it('answers a video without a picture or a known length without seeking', async () => {
    const {dom, videos, drawThumbnail} = fakeDom();
    const reply = analyseMedia(job('video'), dom);
    define(videos[0] ?? {}, {
      duration: Number.POSITIVE_INFINITY,
      videoWidth: 0,
      videoHeight: 0,
    });
    fire(videos[0], 'loadedmetadata');
    expect(await reply).toEqual({ok: true});
    expect(seeks).toEqual([]);
    expect(drawThumbnail).not.toHaveBeenCalled();
  });

  it('skips the thumbnail when the job asks for none', async () => {
    const {dom, videos, drawThumbnail} = fakeDom();
    const reply = analyseMedia(job('video', false), dom);
    define(videos[0] ?? {}, {duration: 3, videoWidth: 640, videoHeight: 360});
    fire(videos[0], 'loadedmetadata');
    expect(await reply).toEqual({
      ok: true,
      duration: 3,
      width: 640,
      height: 360,
    });
    expect(drawThumbnail).not.toHaveBeenCalled();
  });

  it('answers the decoder error of a video it cannot read, cut to the cap', async () => {
    const {dom, videos} = fakeDom();
    const reply = analyseMedia(job('video'), dom);
    const message = 'x'.repeat(MAX_ANALYSIS_MESSAGE_LENGTH + 10);
    define(videos[0] ?? {}, {error: {code: 4, message}});
    fire(videos[0], 'error');
    expect(await reply).toEqual({
      ok: false,
      reason: 'unsupported',
      message: message.slice(0, MAX_ANALYSIS_MESSAGE_LENGTH),
    });
    expect(videos[0]?.hasAttribute('src')).toBe(false);
  });

  it('answers a failed seek as the decoder error', async () => {
    const {dom, videos} = fakeDom();
    const reply = analyseMedia(job('video'), dom);
    define(videos[0] ?? {}, {duration: 5, videoWidth: 640, videoHeight: 360});
    fire(videos[0], 'loadedmetadata');
    await vi.waitFor(() => expect(seeks).toHaveLength(1));
    define(videos[0] ?? {}, {error: {code: 3, message: 'Invented'}});
    fire(videos[0], 'error');
    expect(await reply).toEqual({
      ok: false,
      reason: 'decode',
      message: 'Invented',
    });
  });

  it('reads the duration of audio', async () => {
    const {dom, audios} = fakeDom();
    const reply = analyseMedia(job('audio'), dom);
    define(audios[0] ?? {}, {duration: 200});
    fire(audios[0], 'loadedmetadata');
    expect(await reply).toEqual({ok: true, duration: 200});
    expect(audios[0]?.hasAttribute('src')).toBe(false);
  });

  it('reads an image and draws the middle of it', async () => {
    const {dom, images, drawThumbnail} = fakeDom();
    const reply = analyseMedia(job('image'), dom);
    define(images[0] ?? {}, {naturalWidth: 400, naturalHeight: 300});
    fire(images[0], 'load');
    expect(await reply).toEqual({
      ok: true,
      width: 400,
      height: 300,
      thumbnail: THUMBNAIL,
    });
    expect(drawThumbnail).toHaveBeenCalledWith(
      images[0],
      {x: 0, y: 37.5, width: 400, height: 225},
      SIZE,
    );
    expect(images[0]?.hasAttribute('src')).toBe(false);
  });

  it('answers an image it cannot decode', async () => {
    const {dom, images} = fakeDom();
    const reply = analyseMedia(job('image'), dom);
    fire(images[0], 'error');
    expect(await reply).toMatchObject({ok: false, reason: 'decode'});
  });
});

describe('thumbnail drawing', () => {
  it('draws nothing when the canvas has no 2D context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(
      drawOnCanvas(
        document.createElement('img'),
        {x: 0, y: 0, width: 1, height: 1},
        SIZE,
      ),
    ).toBeNull();
  });
});
