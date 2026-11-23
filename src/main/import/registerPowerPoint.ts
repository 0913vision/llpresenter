import {powerpointEndpoints} from '@contracts/ipc/powerpoint';
import type {
  PowerPointOwnedImagesRequest,
  PowerPointOwnedImagesResult,
} from '@core/schema/powerpointImport';
import {IpcHost, pushToWindow, type Caller} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {PowerPointExports, type ExportListener} from './powerpointExports';
import {choosePowerPointFile, type FileChooserOptions} from './powerpointFile';
import {PowerPointImagesJob} from './powerpointImages';
import {PowerPointJobs} from './powerpointJob';
import {PowerPointReader} from './powerpointReader';
import {PowerPointTurns} from './powerpointTurns';
import {
  storeBackgrounds,
  storeSlidePictures,
  type PictureStore,
} from './storePictures';
import {TemporaryPictures} from './temporaryPictures';

export interface PowerPointImportRegistration extends FileChooserOptions {
  readonly media?: Promise<PictureStore | null>;
  readonly log: Logger;
}

const NOT_STORED: PowerPointOwnedImagesResult = {
  ok: false,
  message: 'PowerPoint 이미지 가져오기 실패',
};

async function storePictures(
  {paths, title}: PowerPointOwnedImagesRequest,
  media: PictureStore,
  log: Logger,
): Promise<PowerPointOwnedImagesResult> {
  try {
    const ids =
      title === undefined
        ? await storeSlidePictures(media, paths)
        : await storeBackgrounds(media, paths, title);
    return {ok: true, value: [...ids]};
  } catch (error) {
    log.warn('could not store PowerPoint pictures', error);
    return NOT_STORED;
  }
}

/**
 * Answers the calls that bring in PowerPoint files: reading one, drawing its
 * slides or their backgrounds, and storing the pictures.
 *
 * @returns A function that stops answering and removes the pictures.
 */
export function registerPowerPointImport(
  context: PowerPointImportRegistration,
  jobs: Pick<PowerPointJobs, 'run' | 'dispose'> &
    Partial<Pick<PowerPointJobs, 'cancel'>> = new PowerPointJobs(),
  images: Pick<PowerPointImagesJob, 'run' | 'cancel'> & {
    readonly converter?: Pick<PowerPointImagesJob, 'run' | 'cancel'>;
  } = new PowerPointImagesJob(),
): () => void {
  const {log} = context;
  const ipc = new IpcHost(log);
  const pictures = new TemporaryPictures(log);
  const options = {
    choose: () => choosePowerPointFile(context),
    jobs,
    images,
    converter: images.converter ?? new PowerPointImagesJob(),
    turns: new PowerPointTurns(),
    pictures,
    log,
  };
  const reader = new PowerPointReader(options);
  const exports = new PowerPointExports(options);
  let disposed = false;
  const isDisposed = (): boolean => disposed;
  const listenerOf = ({contents}: Caller): ExportListener => ({
    isClosed: () => contents.isDestroyed(),
    report: value => {
      pushToWindow(contents, powerpointEndpoints.imageProgress, {value, log});
    },
  });
  ipc.query(powerpointEndpoints.read, ({contents}) =>
    reader.read(fileName => {
      const value = {fileName};
      pushToWindow(contents, powerpointEndpoints.reading, {value, log});
    }),
  );
  ipc.query(powerpointEndpoints.cancelRead, () => reader.cancel());
  ipc.query(powerpointEndpoints.images, caller =>
    exports.slides(listenerOf(caller)),
  );
  ipc.query(powerpointEndpoints.cancelImages, () => exports.cancel());
  ipc.request(powerpointEndpoints.backgrounds, ({indices}, caller) =>
    exports.backgrounds(() => reader.current, indices, listenerOf(caller)),
  );
  ipc.request(powerpointEndpoints.previewImage, ({path}) =>
    pictures.read(path),
  );
  ipc.request(powerpointEndpoints.release, ({path}) => pictures.release(path));
  ipc.request(powerpointEndpoints.storeImages, async request => {
    const {paths} = request;
    if (
      new Set(paths).size !== paths.length ||
      !paths.every(path => pictures.has(path))
    ) {
      return NOT_STORED;
    }
    const media = await context.media;
    if (!media || isDisposed()) {
      return {ok: false, message: '미디어 저장소를 사용할 수 없습니다'};
    }
    return storePictures(request, media, log);
  });
  return () => {
    if (disposed) return;
    disposed = true;
    ipc.close();
    exports.dispose();
    reader.dispose();
    jobs.dispose();
    pictures.dispose();
  };
}
