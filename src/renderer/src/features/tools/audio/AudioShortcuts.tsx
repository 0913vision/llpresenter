import {useSyncExternalStore, type JSX} from 'react';
import {audioTracks, audioPlayCommand} from '@core/media';
import {commandBindings, shortcutCommands} from '@core/shortcuts';
import {commandBindingStore} from '@renderer/ui/keys/commandBindings';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/popups/notices';
import {useMediaDocument} from '../useMediaDocument';
import {useAudioMissing} from './useAudioMissing';
import {useAudioSelection} from './useAudioSelection';
import {useAudioLoopEditing} from './audioLoop';

/** Loads audio command state while a default or assigned audio key is active. */
export function AudioShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  return shortcutCommands.some(
    ({id}) =>
      id.startsWith('audio.') && commandBindings(id, bindings).length > 0,
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
  const document = useMediaDocument(onProblem, 'audio');
  const missing = useAudioMissing(onProblem);
  const chosen = useAudioSelection(view => view.chosen);
  const playlists = document?.value.audioPlaylists ?? [];
  const selected = playlists.find(item => item.id === chosen) ?? playlists[0];
  const editing = useAudioLoopEditing(api, onProblem);
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
