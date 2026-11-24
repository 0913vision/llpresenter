import {followLatest} from '@core/common/followLatest';
import {logFailure} from '@renderer/platform/logFailure';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaId} from '@core/schema/common/ids';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';

/**
 * The ids of the audio files that the app reports as missing, kept up to date.
 */
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
    return followLatest(
      {read: api.media.missing, subscribe: api.media.subscribeMissing},
      {
        apply: ids => setMissing(new Set(ids)),
        failed: (cause, pushed) => {
          if (pushed) return;
          logFailure(api, 'Could not check audio files', cause);
          report.current?.(
            warningNotice('audio:missing', '오디오 파일 상태 확인 실패'),
          );
        },
      },
    );
  }, []);
  return missing;
}
