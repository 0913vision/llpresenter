import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {subscribeMediaDocument} from '@renderer/features/media/subscribeMediaDocument';

export function useNoticeMedia(
  onProblem: ((notice: Notice) => void) | undefined,
): MediaDocument | null {
  const [document, setDocument] = useState<MediaDocument | null>(null);
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    const api = window.llp;
    if (!api) return undefined;
    return subscribeMediaDocument(api.media, setDocument, (cause: unknown) => {
      api.log.write({
        level: 'error',
        message: 'Could not load notice media',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      report.current?.({
        key: 'notice:media',
        kind: 'warning',
        icon: 'warning',
        title: '공지 이미지 불러오기 실패',
        time: noticeTime(),
      });
    });
  }, []);
  return document;
}
