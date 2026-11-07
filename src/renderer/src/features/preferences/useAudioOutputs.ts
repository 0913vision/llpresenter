import {useContext, useEffect, useState} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import type {AudioDevice} from '@core/media/audioOutput';
import {deviceApi, listAudioOutputs} from '@renderer/rendering/audioSink';

/** The connected audio output devices, read again whenever the devices change. */
export function useAudioOutputs(
  list: () => Promise<readonly AudioDevice[]> = listAudioOutputs,
): readonly AudioDevice[] {
  const readiness = useContext(LoadReadinessContext);
  const [devices, setDevices] = useState<readonly AudioDevice[]>([]);
  useEffect(() => {
    let current = true;
    const ready = readiness?.begin();
    const refresh = (): void => {
      list()
        .then(found => {
          if (current) setDevices(found);
          ready?.();
        })
        .catch((error: unknown) => {
          console.warn('Could not list the audio output devices', error);
          ready?.();
        });
    };
    refresh();
    deviceApi()?.addEventListener('devicechange', refresh);
    return () => {
      current = false;
      ready?.();
      deviceApi()?.removeEventListener('devicechange', refresh);
    };
  }, [list, readiness]);
  return devices;
}
