import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {themeScreenOrder} from '@core/themes/screenOrder';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useLive} from '@renderer/session/live';
import {MainTimerClock} from '@renderer/rendering/mainTimerClock';
import {noticeTime, type Notice} from '@renderer/ui/notices';
export function useThemeResources(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const document = useSettingsDocument(
    active ? 'themes' : null,
    '테마',
    onProblem,
  );

  const screensDocument = useSettingsDocument(
    active ? 'screens' : null,
    '화면',
    onProblem,
  );

  const timers = useSettingsDocument(
    active ? 'timers' : null,
    '타이머',
    onProblem,
  );

  const [media, setMedia] = useState<MediaDocument | null>(null);

  const timerRuns = useLive(view => view.state?.timers);

  const timerClock = useRef<MainTimerClock | null>(null);

  const reportRef = useRef(onProblem);

  const api = window.llp;

  useEffect(() => {
    if (!active || api === undefined) return undefined;
    timerClock.current = new MainTimerClock(
      () => api.live.clock(),
      (message, error) =>
        api.log.write({level: 'error', message, detail: String(error)}),
    );
    return () => {
      timerClock.current = null;
    };
  }, [active, api]);

  useLayoutEffect(() => {
    reportRef.current = onProblem;
  });

  useEffect(() => {
    if (!active || api === undefined) return undefined;
    let alive = true;
    let revision = -1;
    const accept = (next: MediaDocument): void => {
      if (!alive || next.revision <= revision) return;
      revision = next.revision;
      setMedia(next);
    };
    const stop = api.media.subscribe(accept);
    api.media.get().then(accept, (error: unknown) => {
      api.log.write({
        level: 'error',
        message: 'Could not load theme images',
        detail: String(error),
      });
      if (alive) {
        reportRef.current?.({
          key: 'screens:themes:images',
          kind: 'warning',
          icon: 'warning',
          title: '그림 목록 불러오기 실패',
          time: noticeTime(),
        });
      }
    });
    return () => {
      alive = false;
      stop();
    };
  }, [active, api]);

  const screens = themeScreenOrder(screensDocument?.value.screens ?? []);
  return {
    document,
    screens,
    timers: timers?.value.timers ?? [],
    renderTimers: {
      list: timers?.value.timers ?? [],
      runs: timerRuns,
      now: () =>
        timerClock.current?.now() ?? {
          timer: performance.timeOrigin + performance.now(),
          wall: Date.now(),
        },
    },
    images: media?.value.items.filter(item => item.kind === 'image') ?? [],
  };
}
