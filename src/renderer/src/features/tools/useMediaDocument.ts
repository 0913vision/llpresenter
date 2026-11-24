import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {type Notice, warningNotice} from '@renderer/ui/notices';
import {subscribeMediaDocument} from '@renderer/features/media/subscribeMediaDocument';

/** Which tab reads the media, and how it tells that the read failed. */
const READERS = {
  audio: {
    key: 'audio:load',
    log: 'Could not load audio playlists',
    title: '오디오 재생목록 불러오기 실패',
  },
  prop: {
    key: 'prop:load',
    log: 'Could not load prop media',
    title: '그래픽 이미지 불러오기 실패',
  },
  macro: {
    key: 'macro:media',
    log: 'Could not load macro media',
    title: '미디어 불러오기 실패',
  },
} as const;

/** The media document as it changes, or null until it was read. */
export function useMediaDocument(
  onProblem: ((notice: Notice) => void) | undefined,
  reader: keyof typeof READERS,
): MediaDocument | null {
  const [document, setDocument] = useState<MediaDocument | null>(null);
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    const api = window.llp;
    if (!api) return undefined;
    const {key, log, title} = READERS[reader];
    return subscribeMediaDocument(api.media, setDocument, (cause: unknown) => {
      api.log.write({
        level: 'error',
        message: log,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      report.current?.(warningNotice(key, title));
    });
  }, [reader]);
  return document;
}
