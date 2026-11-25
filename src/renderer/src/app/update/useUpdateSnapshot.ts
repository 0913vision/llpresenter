import {useEffect, useState} from 'react';
import type {UpdateApi} from '@contracts/ipc/update';
import type {UpdateSnapshot} from '@core/schema/app/update';

/**
 * The latest update state main sends, ignoring an older one that arrives
 * late. `resumeEdits` runs when an installation stops without restarting, so
 * editing that the shutdown paused goes on.
 */
export function useUpdateSnapshot(
  api: UpdateApi | undefined,
  resumeEdits?: () => void,
): UpdateSnapshot | null {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null);
  useEffect(() => {
    if (api === undefined) return undefined;
    let mounted = true;
    let latestRevision = -1;
    let installing = false;
    const receive = (next: UpdateSnapshot): void => {
      if (!mounted || next.revision < latestRevision) return;
      latestRevision = next.revision;
      const nextInstalling =
        next.status.kind === 'installing' || next.status.kind === 'restarting';
      if (installing && !nextInstalling) resumeEdits?.();
      installing = nextInstalling;
      setSnapshot(next);
    };
    const stop = api.subscribe(receive);
    void api.get().then(receive, (error: unknown) => {
      window.llp?.log.write({
        level: 'warn',
        message: 'Could not read update state',
        detail: String(error),
      });
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [api, resumeEdits]);
  return snapshot;
}
