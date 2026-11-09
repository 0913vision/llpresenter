import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';

/** Reports the mounted control's loaded service on an idle renderer turn. */
export function useLaunchReady(api: LlpApi | undefined): void {
  useEffect(() => {
    if (api === undefined) return undefined;
    let stopped = false;
    let frame: number | undefined;
    let idle: number | undefined;
    api.service.get().then(
      () => {
        if (stopped) return;
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            idle = requestIdleCallback(() => {
              if (!stopped) api.service.ready();
            });
          });
        });
      },
      (error: unknown) =>
        api.log.write({
          level: 'warn',
          message: 'Could not confirm launch service readiness',
          detail: String(error),
        }),
    );
    return () => {
      stopped = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [api]);
}
