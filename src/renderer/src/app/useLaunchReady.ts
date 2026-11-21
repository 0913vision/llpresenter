import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {LoadReadiness} from '@renderer/ui/loadReadiness';
import {isItemRow} from '@core/presentation/model';
import {useShow} from '@renderer/session/show';
import {
  hasRetainedGrid,
  subscribeRetainedGrids,
} from '@renderer/session/shownItem';

function fontsReady(): Promise<unknown> {
  try {
    return document.fonts.ready;
  } catch {
    return Promise.resolve();
  }
}

/** Reports the first complete control view after its data, images and fonts settle. */
export function useLaunchReady(
  api: LlpApi | undefined,
  readiness?: LoadReadiness,
): void {
  useEffect(() => {
    if (api === undefined) return undefined;
    let stopped = false;
    let sent = false;
    let loaded = false;
    let preparing = false;
    let frame: number | undefined;
    let idle: number | undefined;
    let expectedService: string | null = null;
    const isReady = (): boolean =>
      (readiness?.getSnapshot() === 0 || readiness === undefined) &&
      useShow.getState().serviceId === expectedService &&
      (expectedService === null ||
        useShow
          .getState()
          .rows.filter(isItemRow)
          .every(row => hasRetainedGrid(expectedService ?? '', row.id)));
    const attempt = (): void => {
      if (stopped || sent || !loaded || !isReady() || preparing) return;
      preparing = true;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (stopped) return;
        if (!isReady()) {
          preparing = false;
          return;
        }
        const images = [...document.images].filter(
          image =>
            image.getClientRects().length > 0 &&
            (image.currentSrc !== '' ||
              (image.getAttribute('src') ?? '') !== ''),
        );
        const decoded = images.map(image =>
          typeof image.decode === 'function'
            ? Promise.resolve().then(() => image.decode())
            : Promise.resolve(),
        );
        Promise.allSettled([fontsReady(), ...decoded]).then(
          () => {
            if (stopped) return;
            if (!isReady()) {
              preparing = false;
              return;
            }
            frame = requestAnimationFrame(() => {
              frame = undefined;
              idle = requestIdleCallback(
                () => {
                  idle = undefined;
                  preparing = false;
                  if (stopped || sent) return;
                  if (!isReady()) return;
                  sent = true;
                  api.service.ready();
                },
                {timeout: 1000},
              );
            });
          },
          (error: unknown) => {
            preparing = false;
            api.log.write({
              level: 'warn',
              message: 'Could not prepare the control view',
              detail: String(error),
            });
          },
        );
      });
    };
    const stopReadiness = readiness?.subscribe(attempt);
    const stopGrids = subscribeRetainedGrids(attempt);
    const stopShow = useShow.subscribe(attempt);
    api.service.get().then(
      service => {
        expectedService = service?.id ?? null;
        loaded = true;
        attempt();
      },
      (error: unknown) => {
        expectedService = useShow.getState().serviceId;
        api.log.write({
          level: 'warn',
          message: 'Could not confirm launch service readiness',
          detail: String(error),
        });
        loaded = true;
        attempt();
      },
    );
    return () => {
      stopped = true;
      stopReadiness?.();
      stopGrids();
      stopShow();
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [api, readiness]);
}
