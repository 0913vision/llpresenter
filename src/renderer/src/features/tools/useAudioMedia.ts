import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {subscribeMediaDocument} from '@renderer/features/media/subscribeMediaDocument';

export function useAudioMedia(
  onProblem: ((notice: Notice) => void) | undefined,
  area: 'audio' | 'prop' = 'audio',
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
        message:
          area === 'audio'
            ? 'Could not load audio playlists'
            : 'Could not load prop media',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      report.current?.({
        key: `${area}:load`,
        kind: 'warning',
        icon: 'warning',
        title:
          area === 'audio'
            ? '오디오 재생목록 불러오기 실패'
            : '그래픽 이미지 불러오기 실패',
        time: noticeTime(),
      });
    });
  }, [area]);
  return document;
}
