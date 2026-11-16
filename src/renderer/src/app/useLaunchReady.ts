import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {LoadReadiness} from '@renderer/ui/loadReadiness';

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
    const isReady = (): boolean =>
      readiness?.getSnapshot() === 0 || readiness === undefined;
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
    api.service.get().then(
      () => {
        loaded = true;
        attempt();
      },
      (error: unknown) => {
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
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [api, readiness]);
}
