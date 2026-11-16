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
  const [load, setLoad] = useState({
    active,
    themesFailed: false,
    screensFailed: false,
  });
  if (load.active !== active) {
    setLoad({active, themesFailed: false, screensFailed: false});
  }
  const reportLoad = (notice: Notice): void => {
    if (notice.key === 'screens:load:themes') {
      setLoad(previous => ({...previous, themesFailed: true}));
    } else if (notice.key === 'screens:load:screens') {
      setLoad(previous => ({...previous, screensFailed: true}));
    }
    onProblem?.(notice);
  };
  const document = useSettingsDocument(
    active ? 'themes' : null,
    '테마',
    reportLoad,
  );

  const screensDocument = useSettingsDocument(
    active ? 'screens' : null,
    '화면',
    reportLoad,
  );

  const timers = useSettingsDocument(
    active ? 'timers' : null,
    '타이머',
    onProblem,
  );

  const [media, setMedia] = useState<MediaDocument | null>(null);

  const timerRuns = useLive(view => view.state?.timers);

  const timerClock = useRef<MainTimerClock | null>(null);
  const [, setClockRevision] = useState(0);

  const reportRef = useRef(onProblem);

  const api = window.llp;

  useEffect(() => {
    if (!active || api === undefined) return undefined;
    timerClock.current = new MainTimerClock(
      () => api.live.clock(),
      (message, error) =>
        api.log.write({level: 'error', message, detail: String(error)}),
      {
        read: api.live.wallClock,
        subscribe: api.live.subscribeWallClock,
        onChange: () => setClockRevision(value => value + 1),
      },
    );
    return () => {
      timerClock.current?.dispose();
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
          title: '이미지 목록 불러오기 실패',
          time: noticeTime(),
        });
      }
    });
    return () => {
      alive = false;
      stop();
    };
  }, [active, api]);

  const savedScreens = screensDocument?.value.screens ?? [];
  const screens = themeScreenOrder(savedScreens);
  const bibleSplitScreen =
    savedScreens.find(screen => screen.kind === 'audience') ?? savedScreens[0];
  return {
    document,
    themesFailed: load.themesFailed,
    screensReady:
      screensDocument !== null || load.screensFailed || api === undefined,
    screens,
    bibleSplitScreen,
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
    images:
      media?.value.items.filter(
        item => item.kind === 'image' && item.internal !== true,
      ) ?? [],
  };
}
