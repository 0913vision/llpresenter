import {coverCrop, type Crop, type PixelSize} from '@core/media/coverCrop';
import {
  MAX_ANALYSIS_MESSAGE_LENGTH,
  type AnalysisFailureReason,
  type AnalysisJob,
  type AnalysisReply,
} from '@core/schema/mediaAnalysis';

/** Where a video's thumbnail is taken, or half way through a shorter video. */
export const THUMBNAIL_FRAME_SECONDS = 1;

/** The JPEG quality of a thumbnail, from 0 to 1. */
export const THUMBNAIL_QUALITY = 0.8;

/** What the analysis page reads files with, so tests can stand in for it. */
export interface AnalysisDom {
  readonly createVideo: () => HTMLVideoElement;
  readonly createAudio: () => HTMLAudioElement;
  readonly createImage: () => HTMLImageElement;
  /** The thumbnail as a JPEG data URL; null when the canvas can't draw. */
  readonly drawThumbnail: (
    source: HTMLVideoElement | HTMLImageElement,
    crop: Crop,
    size: PixelSize,
  ) => string | null;
}

const MEDIA_ERROR_REASONS: Readonly<Record<number, AnalysisFailureReason>> = {
  1: 'aborted',
  2: 'network',
  3: 'decode',
  4: 'unsupported',
};

/** Draws a thumbnail on a canvas. */
export function drawOnCanvas(
  source: HTMLVideoElement | HTMLImageElement,
  crop: Crop,
  size: PixelSize,
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size.width,
    size.height,
  );
  return canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);
}

/** The analysis page's own elements and canvas. */
export const pageDom: AnalysisDom = {
  createVideo: () => document.createElement('video'),
  createAudio: () => document.createElement('audio'),
  createImage: () => document.createElement('img'),
  drawThumbnail: drawOnCanvas,
};

function failure(
  reason: AnalysisFailureReason,
  message: string,
): AnalysisReply {
  return {
    ok: false,
    reason,
    message: message.slice(0, MAX_ANALYSIS_MESSAGE_LENGTH),
  };
}

function mediaFailure({error}: HTMLMediaElement): AnalysisReply {
  return failure(
    MEDIA_ERROR_REASONS[error?.code ?? 0] ?? 'decode',
    error?.message ?? '',
  );
}

function settle(target: EventTarget, event: string): Promise<boolean> {
  return new Promise(resolve => {
    const finish = (succeeded: boolean) => (): void => {
      target.removeEventListener(event, onEvent);
      target.removeEventListener('error', onError);
      resolve(succeeded);
    };
    const onEvent = finish(true);
    const onError = finish(false);
    target.addEventListener(event, onEvent);
    target.addEventListener('error', onError);
  });
}

type Facts = Extract<AnalysisReply, {ok: true}>;

function pixelSize(width: number, height: number): PixelSize | null {
  const whole = (pixels: number): boolean =>
    Number.isInteger(pixels) && pixels > 0;
  return whole(width) && whole(height) ? {width, height} : null;
}

function durationOf({duration}: HTMLMediaElement): Pick<Facts, 'duration'> {
  return Number.isFinite(duration) && duration >= 0 ? {duration} : {};
}

function thumbnailOf(
  dom: AnalysisDom,
  source: HTMLVideoElement | HTMLImageElement,
  {picture, size}: {readonly picture: PixelSize; readonly size: PixelSize},
): Pick<Facts, 'thumbnail'> {
  const thumbnail = dom.drawThumbnail(source, coverCrop(picture, size), size);
  return thumbnail === null ? {} : {thumbnail};
}

function release(element: HTMLMediaElement): void {
  element.removeAttribute('src');
  element.load();
}

async function analyseVideo(
  {url, thumbnail}: AnalysisJob,
  dom: AnalysisDom,
): Promise<AnalysisReply> {
  const video = dom.createVideo();
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';
  try {
    const loaded = settle(video, 'loadedmetadata');
    video.src = url;
    if (!(await loaded)) return mediaFailure(video);
    const size = pixelSize(video.videoWidth, video.videoHeight);
    const facts: Facts = {ok: true, ...durationOf(video), ...size};
    if (thumbnail === null || size === null) return facts;
    const seeked = settle(video, 'seeked');
    video.currentTime = Math.min(
      THUMBNAIL_FRAME_SECONDS,
      (facts.duration ?? 0) / 2,
    );
    if (!(await seeked)) return mediaFailure(video);
    return {
      ...facts,
      ...thumbnailOf(dom, video, {picture: size, size: thumbnail}),
    };
  } finally {
    release(video);
  }
}

async function analyseAudio(
  {url}: AnalysisJob,
  dom: AnalysisDom,
): Promise<AnalysisReply> {
  const audio = dom.createAudio();
  audio.preload = 'metadata';
  try {
    const loaded = settle(audio, 'loadedmetadata');
    audio.src = url;
    if (!(await loaded)) return mediaFailure(audio);
    return {ok: true, ...durationOf(audio)};
  } finally {
    release(audio);
  }
}

async function analyseImage(
  {url, thumbnail}: AnalysisJob,
  dom: AnalysisDom,
): Promise<AnalysisReply> {
  const image = dom.createImage();
  image.crossOrigin = 'anonymous';
  try {
    const loaded = settle(image, 'load');
    image.src = url;
    if (!(await loaded)) {
      return failure('decode', 'The image could not be read');
    }
    const size = pixelSize(image.naturalWidth, image.naturalHeight);
    if (thumbnail === null || size === null) return {ok: true, ...size};
    return {
      ok: true,
      ...size,
      ...thumbnailOf(dom, image, {picture: size, size: thumbnail}),
    };
  } finally {
    image.removeAttribute('src');
  }
}

/**
 * Reads one file with Chromium's own decoders, as the output windows play it:
 * the duration of video and audio, the pixel size of video and images, and a
 * thumbnail when the job asks for one. A file the decoders refuse answers why.
 */
export function analyseMedia(
  job: AnalysisJob,
  dom: AnalysisDom = pageDom,
): Promise<AnalysisReply> {
  switch (job.kind) {
    case 'video':
      return analyseVideo(job, dom);
    case 'audio':
      return analyseAudio(job, dom);
    case 'image':
      return analyseImage(job, dom);
  }
}
