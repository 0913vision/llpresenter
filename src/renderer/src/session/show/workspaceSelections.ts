import {useShow, type ShowView} from './showStore';
import {librarySourceId} from './showLibrary';

type Selection = Pick<
  ShowView,
  | 'serviceId'
  | 'serviceEpoch'
  | 'openItemId'
  | 'selectedTile'
  | 'librarySong'
  | 'bibleSources'
>;

/** The selection the shared view holds now. */
function selectionOf(view: ShowView): Selection {
  return {
    serviceId: view.serviceId,
    serviceEpoch: view.serviceEpoch,
    openItemId: view.openItemId,
    selectedTile: view.selectedTile,
    librarySong: view.librarySong,
    bibleSources: view.bibleSources,
  };
}

/**
 * What the view takes back of a saved selection: its item and slide while the
 * item is still there in the same service, a library song or a passage with
 * it; otherwise nothing chosen.
 */
function restored(
  saved: Selection | undefined,
  view: ShowView,
): Partial<ShowView> {
  const id = saved?.openItemId ?? null;
  if (
    saved === undefined ||
    id === null ||
    saved.serviceId !== view.serviceId ||
    saved.serviceEpoch !== view.serviceEpoch
  ) {
    return {openItemId: null, selectedTile: 0};
  }
  const library = saved.librarySong;
  const isLibrary = library != null && id === librarySourceId(library.songId);
  const bible = saved.bibleSources.find(source => source.id === id);
  if (
    !isLibrary &&
    bible === undefined &&
    !view.rows.some(row => row.id === id)
  ) {
    return {openItemId: null, selectedTile: 0};
  }
  return {
    openItemId: id,
    selectedTile: saved.selectedTile,
    ...(isLibrary
      ? {
          librarySong:
            view.librarySong?.songId === library.songId
              ? view.librarySong
              : library,
        }
      : {}),
    ...(bible === undefined
      ? {}
      : {
          bibleSources: view.bibleSources.some(source => source.id === id)
            ? view.bibleSources
            : [bible, ...view.bibleSources],
        }),
  };
}

/** Keeps each workspace's selection while the shared view represents the visible one. */
export class WorkspaceSelections {
  private active: 'show' | 'prep' = 'show';
  private readonly saved: Partial<Record<'show' | 'prep', Selection>> = {};

  activate(next: 'show' | 'prep' | 'library' | 'screens'): void {
    if (next === 'screens' || next === 'library' || next === this.active) {
      return;
    }
    const view = useShow.getState();
    this.saved[this.active] = selectionOf(view);
    this.active = next;
    useShow.setState(restored(this.saved[next], view));
  }
}
