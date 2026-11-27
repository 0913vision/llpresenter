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

/** Keeps each workspace's selection while the shared view represents the visible one. */
export class WorkspaceSelections {
  private active: 'show' | 'prep' = 'show';
  private readonly saved: Partial<Record<'show' | 'prep', Selection>> = {};

  activate(next: 'show' | 'prep' | 'library' | 'screens'): void {
    if (next === 'screens' || next === 'library' || next === this.active) {
      return;
    }
    const view = useShow.getState();
    this.saved[this.active] = {
      serviceId: view.serviceId,
      serviceEpoch: view.serviceEpoch,
      openItemId: view.openItemId,
      selectedTile: view.selectedTile,
      librarySong: view.librarySong,
      bibleSources: view.bibleSources,
    };
    this.active = next;
    const saved = this.saved[next];
    const id = saved?.openItemId ?? null;
    const library = saved?.librarySong;
    const bible = saved?.bibleSources.find(source => source.id === id);
    const isLibrary = library != null && id === librarySourceId(library.songId);
    const isBible = bible !== undefined;
    const exists =
      saved?.serviceId === view.serviceId &&
      saved.serviceEpoch === view.serviceEpoch &&
      id !== null &&
      (isLibrary || isBible || view.rows.some(row => row.id === id));
    useShow.setState({
      openItemId: exists ? id : null,
      selectedTile: exists ? saved.selectedTile : 0,
      ...(exists && isLibrary
        ? {
            librarySong:
              view.librarySong?.songId === library.songId
                ? view.librarySong
                : library,
          }
        : {}),
      ...(exists && isBible
        ? {
            bibleSources: view.bibleSources.some(source => source.id === id)
              ? view.bibleSources
              : [bible, ...view.bibleSources],
          }
        : {}),
    });
  }

  /**
   * The live item changed: 진행's selection moves to it, on screen at once or
   * kept for when 진행 shows again; an item the operator clicked to look
   * ahead stays chosen only until the next change (USER Nov 28: "live에 후하게").
   */
  followLive(itemId: string): void {
    const view = useShow.getState();
    if (!view.rows.some(row => row.id === itemId)) return;
    if (this.active === 'show') {
      if (view.openItemId !== itemId) {
        useShow.setState({openItemId: itemId, selectedTile: 0});
      }
      return;
    }
    const saved = this.saved.show;
    this.saved.show = {
      serviceId: view.serviceId,
      serviceEpoch: view.serviceEpoch,
      librarySong: saved?.librarySong ?? null,
      bibleSources: saved?.bibleSources ?? [],
      openItemId: itemId,
      selectedTile: saved?.openItemId === itemId ? saved.selectedTile : 0,
    };
  }
}
