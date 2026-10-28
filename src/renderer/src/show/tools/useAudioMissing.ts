import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaId} from '@shared/schema/ids';
import {noticeTime, type Notice} from '@renderer/ui/notices';

export function useAudioMissing(
  onProblem: ((notice: Notice) => void) | undefined,
): ReadonlySet<MediaId> {
  const [missing, setMissing] = useState<ReadonlySet<MediaId>>(() => new Set());
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    const api = window.llp;
    if (!api) return undefined;
    let active = true;
    let pushed = false;
    const stop = api.media.subscribeMissing(ids => {
      pushed = true;
      if (active) setMissing(new Set(ids));
    });
    api.media.missing().then(
      ids => {
        if (active && !pushed) setMissing(new Set(ids));
      },
      (cause: unknown) => {
        if (!active || pushed) return;
        api.log.write({
          level: 'error',
          message: 'Could not check audio files',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        report.current?.({
          key: 'audio:missing',
          kind: 'warning',
          icon: 'warning',
          title: '오디오 파일 상태 확인 실패',
          time: noticeTime(),
        });
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return missing;
}
