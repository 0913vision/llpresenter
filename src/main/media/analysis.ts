import type {MediaId} from '@shared/schema/ids';
import type {Logger} from '../log';
import {AnalysisFiles} from './analysisFiles';
import {openAnalysisPage} from './analysisPage';
import {measureImage} from './measureImage';
import {
  MediaAnalyser,
  type Analysis,
  type AnalysisRequest,
} from './mediaAnalyser';
import {ThumbnailCache} from './thumbnailCache';
import {Thumbnails, type ThumbnailSource} from './thumbnails';

/** The arguments of {@link startMediaAnalysis}. */
export interface MediaAnalysisOptions {
  readonly media: Promise<ThumbnailSource | null>;
  /** `cache\thumbnails` in the app data folder. */
  readonly thumbnailFolder: string;
  readonly log: Logger;
}

/**
 * Media analysis and the thumbnails made with it, which the media scheme and
 * the media backend share.
 */
export interface MediaAnalysis {
  /** The file lent to the analysis page under a token, for the media scheme. */
  readonly lentFile: (token: string) => string | null;
  readonly analyse: (request: AnalysisRequest) => Promise<Analysis>;
  /** A media item's thumbnail file, for the media scheme. */
  readonly thumbnailOf: (mediaId: string) => Promise<string | null>;
  /** Keeps the thumbnail an import made. */
  readonly saveThumbnail: (mediaId: MediaId, jpeg: Uint8Array) => Promise<void>;
  /** Stops following the media list and closes the analysis page. */
  readonly dispose: () => void;
}

/**
 * Starts media analysis: the hidden analysis page opens only when a file needs
 * it, and the thumbnails follow the media list once it opens.
 */
export function startMediaAnalysis({
  media,
  thumbnailFolder,
  log,
}: MediaAnalysisOptions): MediaAnalysis {
  const files = new AnalysisFiles();
  const analyser = new MediaAnalyser({
    openPage: signal => openAnalysisPage(log, signal),
    files,
    measureImage,
    log,
  });
  const thumbnails = new Thumbnails({
    cache: new ThumbnailCache({folder: thumbnailFolder, log}),
    analyse: request => analyser.analyse(request),
    source: media,
    log,
  });
  thumbnails.start().catch((error: unknown) => {
    log.error('could not follow the media list for thumbnails', error);
  });
  return {
    lentFile: token => files.fileOf(token),
    analyse: request => analyser.analyse(request),
    thumbnailOf: mediaId => thumbnails.thumbnailOf(mediaId),
    saveThumbnail: (mediaId, jpeg) => thumbnails.save(mediaId, jpeg),
    dispose: () => {
      thumbnails.dispose();
      analyser.dispose();
    },
  };
}
