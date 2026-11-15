import {useCallback, useEffect, useRef, useState} from 'react';
import type {AudioDevice} from '@core/media/audioOutput';
import {deviceApi, listAudioOutputs} from '@renderer/rendering/audioSink';

let lastKnownOutputs: readonly AudioDevice[] = [];

/** Keep the last successful list visible while refreshing connected devices. */
export function useAudioOutputs(
  list: () => Promise<readonly AudioDevice[]> = listAudioOutputs,
): {devices: readonly AudioDevice[]; refresh: () => void} {
  const sequence = useRef(0);
  const [devices, setDevices] = useState<readonly AudioDevice[]>(() =>
    list === listAudioOutputs ? lastKnownOutputs : [],
  );
  const refresh = useCallback((): void => {
    const request = ++sequence.current;
    void list()
      .then(found => {
        if (sequence.current !== request) return;
        if (list === listAudioOutputs) lastKnownOutputs = found;
        setDevices(found);
      })
      .catch((error: unknown) => {
        console.warn('Could not list the audio output devices', error);
      });
  }, [list]);
  useEffect(() => {
    const requests = sequence;
    refresh();
    deviceApi()?.addEventListener('devicechange', refresh);
    return () => {
      requests.current++;
      deviceApi()?.removeEventListener('devicechange', refresh);
    };
  }, [refresh]);
  return {devices, refresh};
}
