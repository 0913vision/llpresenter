import type {LlpApi} from '@contracts/ipc/api';
import type {LibrarySong} from '@core/schema/services/contentDocuments';
import {pendingWritesOf} from '@renderer/platform/documents/pendingWrites';
import type {Notice} from '@renderer/ui/popups/notices';
import {isUnsaved} from '../songDraftModel';
import {parkSongDraft, show} from './draftOpen';
import {requestLeaveSong} from './draftQuestions';
import {connectSongDraft, draftView as view, useSongDraft} from './draftStore';

/**
 * Follows the library, and asks about the open song before the window closes.
 *
 * @returns A function that stops following. Always call it.
 */
export function startSongDraftSync(
  window: LlpApi | undefined,
  onProblem: (notice: Notice) => void,
): () => void {
  if (window === undefined) return () => undefined;
  connectSongDraft(window, onProblem);
  let stopped = false;
  const accept = (library: readonly LibrarySong[]): void => {
    if (!stopped) useSongDraft.setState({library, libraryStatus: 'ready'});
  };
  const stops = [
    window.songs.subscribeList(accept),
    window.songs.subscribe(({songId, document}) => {
      const {draft} = view();
      if (draft?.document == null || draft.song.id !== songId) return;
      if (document === null) {
        parkSongDraft();
        return;
      }
      if (document.revision <= draft.document.revision) return;
      // NOTE(0913vision): A draft with changes keeps them and saves over the
      // newer file; one without follows the file.
      if (isUnsaved(draft)) {
        useSongDraft.setState({draft: {...draft, document}});
      } else show(document.song, document);
    }),
    pendingWritesOf(window).addDraft(
      () =>
        new Promise(resolve => {
          requestLeaveSong(
            () => resolve('settled'),
            () => resolve('canceled'),
          );
        }),
      error => console.error('Could not settle the song draft', error),
    ),
  ];
  window.songs.list().then(accept, () => {
    if (!stopped) useSongDraft.setState({libraryStatus: 'failed'});
  });
  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}
