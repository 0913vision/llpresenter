import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export function useAudioMedia(
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
    let active = true;
    let revision = -1;
    const accept = (next: MediaDocument): void => {
      if (!active || next.revision <= revision) return;
      revision = next.revision;
      setDocument(next);
    };
    const stop = api.media.subscribe(accept);
    api.media.get().then(accept, (cause: unknown) => {
      if (!active || revision >= 0) return;
      api.log.write({
        level: 'error',
        message: 'Could not load audio playlists',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      report.current?.({
        key: 'audio:load',
        kind: 'warning',
        icon: 'warning',
        title: '오디오 재생목록 불러오기 실패',
        time: noticeTime(),
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, []);
  return document;
}
