import {useCallback, useEffect, useRef, useState} from 'react';
import type {AudioDevice} from '@core/media';
import {deviceApi, listAudioOutputs} from '@renderer/rendering/media/audioSink';

let lastKnownOutputs: readonly AudioDevice[] = [];

/** Keep the last successful list visible while refreshing connected devices. */
export function useAudioOutputs(
  list: () => Promise<readonly AudioDevice[]> = listAudioOutputs,
): {devices: readonly AudioDevice[]; loading: boolean; refresh: () => void} {
  const sequence = useRef(0);
  const [devices, setDevices] = useState<readonly AudioDevice[]>(() =>
    list === listAudioOutputs ? lastKnownOutputs : [],
  );
  const [loading, setLoading] = useState(true);
  const refresh = useCallback((): void => {
    const request = ++sequence.current;
    void list()
      .then(found => {
        if (sequence.current !== request) return;
        if (list === listAudioOutputs) lastKnownOutputs = found;
        setDevices(found);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (sequence.current === request) setLoading(false);
        console.warn('Could not list the audio output devices', error);
      });
  }, [list]);
  useEffect(() => {
    const requests = sequence;
    refresh();
    const onChange = (): void => {
      setLoading(true);
      refresh();
    };
    deviceApi()?.addEventListener('devicechange', onChange);
    return () => {
      requests.current++;
      deviceApi()?.removeEventListener('devicechange', onChange);
    };
  }, [refresh]);
  return {devices, loading, refresh};
}
