import {useEffect, useState} from 'react';
import type {AudioDevice} from '@core/media/audioOutput';
import {deviceApi, listAudioOutputs} from '@renderer/rendering/audioSink';

/** The connected audio output devices, read again whenever the devices change. */
export function useAudioOutputs(
  list: () => Promise<readonly AudioDevice[]> = listAudioOutputs,
): readonly AudioDevice[] {
  const [devices, setDevices] = useState<readonly AudioDevice[]>([]);
  useEffect(() => {
    let current = true;
    const refresh = (): void => {
      list()
        .then(found => {
          if (current) setDevices(found);
        })
        .catch((error: unknown) => {
          console.warn('Could not list the audio output devices', error);
        });
    };
    refresh();
    deviceApi()?.addEventListener('devicechange', refresh);
    return () => {
      current = false;
      deviceApi()?.removeEventListener('devicechange', refresh);
    };
  }, [list]);
  return devices;
}
