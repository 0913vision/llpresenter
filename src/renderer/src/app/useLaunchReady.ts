import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {LoadReadiness} from '@renderer/ui/loadReadiness';
import {LaunchPreparation} from './launchPreparation';

/** Prepares the first view of the control window, and tells main about it. */
export function useLaunchReady(
  api: LlpApi | undefined,
  readiness?: LoadReadiness,
): void {
  useEffect(() => {
    if (api === undefined) return undefined;
    const preparation = new LaunchPreparation(api, readiness);
    preparation.start();
    return () => preparation.stop();
  }, [api, readiness]);
}
