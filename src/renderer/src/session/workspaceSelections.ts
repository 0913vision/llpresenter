import {useShow, type ShowView} from './showStore';
import {librarySourceId} from './showLibrary';

type Selection = Pick<
  ShowView,
  'serviceId' | 'openItemId' | 'selectedTile' | 'librarySong' | 'bibleSource'
>;

/** Keeps each workspace's selection while the shared view represents the visible one. */
export class WorkspaceSelections {
  private active: 'show' | 'prep' = 'show';
  private readonly saved: Partial<Record<'show' | 'prep', Selection>> = {};

  activate(next: 'show' | 'prep' | 'screens'): void {
    if (next === 'screens' || next === this.active) return;
    const view = useShow.getState();
    this.saved[this.active] = {
      serviceId: view.serviceId,
      openItemId: view.openItemId,
      selectedTile: view.selectedTile,
      librarySong: view.librarySong,
      bibleSource: view.bibleSource,
    };
    this.active = next;
    const saved = this.saved[next];
    const id = saved?.openItemId ?? null;
    const library = saved?.librarySong;
    const bible = saved?.bibleSource;
    const isLibrary = library != null && id === librarySourceId(library.songId);
    const isBible = id !== null && id === bible?.id;
    const exists =
      saved?.serviceId === view.serviceId &&
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
            bibleSource: view.bibleSource?.id === id ? view.bibleSource : bible,
          }
        : {}),
    });
  }
}
