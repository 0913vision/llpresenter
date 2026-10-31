import {useSyncExternalStore, type JSX} from 'react';
import {audioTracks} from '@core/media/audioTracks';
import {audioPlayCommand} from '@core/media/audioPlayCommand';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/notices';
import {useAudioMedia} from './useAudioMedia';
import {useAudioMissing} from './useAudioMissing';
import {useAudioSelection} from './state/audioSelection';
import {useToolEditing} from './useToolEditing';
import {setAudioLoop} from './audioLoop';

/** Loads audio command state only when the operator assigned an audio binding. */
export function AudioShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  return Object.keys(bindings).some(
    id => id.startsWith('audio.') && (bindings[id]?.length ?? 0) > 0,
  ) ? (
    <BoundAudioShortcuts onProblem={onProblem} />
  ) : null;
}

function BoundAudioShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): null {
  const api = window.llp;
  const document = useAudioMedia(onProblem);
  const missing = useAudioMissing(onProblem);
  const chosen = useAudioSelection(view => view.chosen);
  const playlists = document?.value.audioPlaylists ?? [];
  const selected = playlists.find(item => item.id === chosen) ?? playlists[0];
  const editing = useToolEditing({
    api,
    onProblem,
    write: (
      api,
      edit: {
        readonly id: NonNullable<typeof selected>['id'];
        readonly loop: boolean;
      },
    ) => setAudioLoop(api, edit.id, edit.loop),
    area: {
      key: 'audio-loop',
      label: '반복',
      log: 'Could not update audio repeat',
    },
  });
  useWindowShortcuts([
    {
      id: 'audio.playPause',
      run: () => {
        const audio = useLive.getState().state?.layers.audio ?? null;
        const first =
          selected === undefined
            ? undefined
            : audioTracks(
                selected,
                document?.value.items ?? [],
                audio?.playback?.source,
              )[0];
        const command = audioPlayCommand({
          audio,
          selected,
          firstPlayable:
            first !== undefined &&
            !first.missing &&
            first.item !== undefined &&
            !missing.has(first.item.id),
        });
        if (command !== null) api?.live.send(command);
      },
    },
    ...(['next', 'previous', 'fadeOut'] as const).map(action => ({
      id: `audio.${action}`,
      run: () => {
        if (useLive.getState().state?.layers.audio?.playback) {
          api?.live.send({type: `audio.${action}`});
        }
      },
    })),
    {
      id: 'audio.toggleRepeat',
      run: () => {
        if (
          selected === undefined ||
          document?.access !== 'editable' ||
          editing.busy
        ) {
          return;
        }
        void editing
          .run({id: selected.id, loop: !selected.loop})
          .catch((error: unknown) =>
            api?.log.write({
              level: 'error',
              message: 'Could not toggle audio repeat',
              detail: String(error),
            }),
          );
      },
    },
  ]);
  return null;
}
