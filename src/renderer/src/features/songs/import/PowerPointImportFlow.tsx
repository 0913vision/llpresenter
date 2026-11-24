import {useEffect} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/popups/notices';
import {importPowerPointSong} from './powerPointSong';

/** Reads a presentation and opens the song it is in the editor, unsaved. */
export function PowerPointImportFlow({
  api,
  onDone,
  onProblem,
  onDismiss,
}: {
  readonly api: LlpApi;
  readonly onDone: () => void;
  readonly onProblem: (notice: Notice) => void;
  readonly onDismiss: (key: string) => void;
}): null {
  useEffect(() => {
    let active = true;
    // NOTE(0913vision): The timer drops the first of the two mounts that React
    // makes in development, which would ask for two files.
    const timer = setTimeout(() => {
      importPowerPointSong(api, {report: onProblem, dismiss: onDismiss})
        .catch((error: unknown) =>
          console.error('Could not import the PowerPoint song', error),
        )
        .finally(() => {
          if (active) onDone();
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, onDone, onProblem, onDismiss]);
  return null;
}
