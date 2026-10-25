import {create} from 'zustand';
import {parseServiceItemId} from '@shared/schema/ids';
import type {ShowService} from '@shared/schema/showService';
import type {ShowLibrarySong} from '@shared/schema/showLibrarySong';
import {
  type ItemId,
  type ServiceRow,
  type SlideTile,
  type TileCursor,
} from '@renderer/show/model';
import {
  adjacentItem,
  liveItem,
  nextTile,
  previousTile,
  tileForLabel,
  type SequenceState,
} from '@renderer/show/navigation';
import {slideLayerOf} from '@renderer/show/slideLayer';
import {sendLive, useLive} from './live';

interface ShowView {
  readonly librarySong: ShowLibrarySong | null;
  // NOTE(0913vision): The revision is null while no service is open.
  readonly revision: number | null;
  readonly serviceId: string | null;
  readonly serviceName: string;
  // NOTE(0913vision): A read-only service comes from a newer app version.
  readonly readOnly: boolean;
  readonly rows: readonly ServiceRow[];
  readonly tiles: Readonly<Record<ItemId, readonly SlideTile[]>>;
  readonly openItemId: ItemId | null;
  readonly selectedTile: number;
  // NOTE(0913vision): Jump keys map a physical key (`KeyboardEvent.code`) to an
  // 이름표 name.
  readonly jumpKeys: Readonly<Record<string, string>>;
}

const noTiles: readonly SlideTile[] = [];
const BACKGROUND_LOOKUP_TIMEOUT_MS = 2000;
let outputRequest = 0;

const noService = {
  revision: null,
  serviceId: null,
  serviceName: '',
  readOnly: false,
  rows: [],
  tiles: {},
  jumpKeys: {},
} as const satisfies Partial<ShowView>;

export const useShow = create<ShowView>(() => ({
  ...noService,
  librarySong: null,
  openItemId: null,
  selectedTile: 0,
}));

export function tilesOf(itemId: ItemId): readonly SlideTile[] {
  const song = useShow.getState().librarySong;
  if (song && itemId === librarySourceId(song.songId)) return song.tiles;
  return useShow.getState().tiles[itemId] ?? noTiles;
}

/** Namespaces a library source without inventing a service item. */
export function librarySourceId(songId: ShowLibrarySong['songId']): ItemId {
  return `library:${songId}`;
}

/** Selects the open source's tiles without copying either projection. */
export function shownTiles(view: ShowView): readonly SlideTile[] | undefined {
  if (view.openItemId === null) return undefined;
  if (
    view.librarySong &&
    view.openItemId === librarySourceId(view.librarySong.songId)
  ) {
    return view.librarySong.tiles;
  }
  return view.tiles[view.openItemId];
}

/** Opens a checked library projection without writing a service or output. */
export function openLibrarySong(song: ShowLibrarySong): void {
  ++outputRequest;
  useShow.setState({
    librarySong: song,
    openItemId: librarySourceId(song.songId),
    selectedTile: 0,
  });
}

/** Updates only the retained library source; a deleted source leaves output alone. */
export function refreshLibrarySong(
  songId: ShowLibrarySong['songId'],
  song: ShowLibrarySong | null,
): void {
  const current = useShow.getState();
  if (
    current.librarySong?.songId !== songId ||
    (song && song.songId !== songId) ||
    (song && song.songRevision < current.librarySong.songRevision)
  ) {
    return;
  }
  const selected = current.openItemId === librarySourceId(songId);
  useShow.setState({
    librarySong: song,
    ...(selected
      ? {
          openItemId: song ? librarySourceId(songId) : null,
          selectedTile: song
            ? Math.min(current.selectedTile, Math.max(0, song.tiles.length - 1))
            : 0,
        }
      : {}),
  });
}

/** The tile on output, taken from the live slide layer. */
export function liveCursor(): TileCursor | null {
  const slide = useLive.getState().state?.layers.slide;
  return slide ? {itemId: slide.itemId, index: slide.position} : null;
}

function sequenceState(): SequenceState {
  const {openItemId} = useShow.getState();
  return {tilesOf, live: liveCursor(), openItemId};
}

/**
 * Opens an item in the 장 panel and selects its first tile. Opening the item
 * that is already open keeps its tile selection.
 */
export function openItem(itemId: ItemId): void {
  if (useShow.getState().openItemId === itemId) return;
  useShow.setState({openItemId: itemId, selectedTile: 0});
}

/** Selects a tile of the open item without outputting it. */
export function selectTile(index: number): void {
  useShow.setState({selectedTile: index});
}

function startServiceItem(itemId: ItemId): void {
  const live = useLive.getState();
  if ((live.lastSlideItemId ?? live.state?.layers.slide?.itemId) === itemId) {
    return;
  }
  if (
    !useShow
      .getState()
      .rows.some(row => row.id === itemId && row.kind !== 'header')
  ) {
    return;
  }
  const id = parseServiceItemId(itemId);
  if (id.ok) sendLive({type: 'item.start', itemId: id.value});
}

/** Outputs a tile and shows it selected in the 장 panel. */
export function outputTile(cursor: TileCursor): void {
  const slide = slideLayerOf(cursor, tilesOf);
  if (!slide) return;
  const request = ++outputRequest;
  const live = useLive.getState();
  const previousItem = live.lastSlideItemId ?? live.state?.layers.slide?.itemId;
  const row = useShow.getState().rows.find(row => row.id === cursor.itemId);
  useShow.setState({openItemId: cursor.itemId, selectedTile: cursor.index});
  const librarySong = useShow.getState().librarySong;
  if (
    librarySong &&
    cursor.itemId === librarySourceId(librarySong.songId) &&
    previousItem !== cursor.itemId &&
    window.llp
  ) {
    outputLibraryTile(cursor, request, live.commandVersion).catch(
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Could not output the library song tile',
          detail: cause instanceof Error ? cause.message : String(cause),
        }),
    );
    return;
  }
  if (
    row?.kind === 'song' &&
    previousItem !== cursor.itemId &&
    (row.background !== undefined || row.problem === 'missing-background') &&
    window.llp !== undefined
  ) {
    outputSongTile({
      cursor,
      request,
      commandVersion: live.commandVersion,
      serviceId: useShow.getState().serviceId,
    }).catch((error: unknown) =>
      window.llp?.log.write({
        level: 'error',
        message: 'Could not output the song tile',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return;
  }
  startServiceItem(cursor.itemId);
  sendLive({type: 'slide.show', slide});
}

interface SongOutput {
  readonly cursor: TileCursor;
  readonly request: number;
  readonly commandVersion: number;
  readonly serviceId: string | null;
}

async function readBackgrounds<T>(read: () => Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Song background lookup timed out')),
          BACKGROUND_LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function outputSongTile({
  cursor,
  request,
  commandVersion,
  serviceId,
}: SongOutput): Promise<void> {
  let service: ShowService | null = null;
  try {
    service = await readBackgrounds(
      () => window.llp?.service.get() ?? Promise.resolve(null),
    );
  } catch (error: unknown) {
    window.llp?.log.write({
      level: 'warn',
      message: 'Could not refresh the song background; kept the current media',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  if (
    request !== outputRequest ||
    commandVersion !== useLive.getState().commandVersion ||
    serviceId !== useShow.getState().serviceId
  ) {
    return;
  }

  if (service !== null && service.id !== serviceId) return;

  if (service !== null && service.id === serviceId) applyService(service);
  const slide = slideLayerOf(cursor, tilesOf);
  if (!slide) return;
  const row =
    service?.id === serviceId
      ? useShow.getState().rows.find(row => row.id === cursor.itemId)
      : undefined;
  startServiceItem(cursor.itemId);
  if (row?.kind === 'song' && row.background !== undefined) {
    const current = useLive.getState().state?.layers.media;
    if (
      current?.mediaId !== row.background.mediaId ||
      current.loop !== row.background.loop
    ) {
      sendLive({type: 'media.show', media: row.background});
    }
  }
  sendLive({type: 'slide.show', slide});
}

async function outputLibraryTile(
  cursor: TileCursor,
  request: number,
  commandVersion: number,
): Promise<void> {
  const songId = useShow.getState().librarySong?.songId;
  if (!songId) return;
  let song: ShowLibrarySong | null;
  try {
    song = await readBackgrounds(
      () => window.llp?.library.showSong({songId}) ?? Promise.resolve(null),
    );
  } catch (cause) {
    window.llp?.log.write({
      level: 'warn',
      message: 'Could not refresh the library song; kept the current output',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
    return;
  }
  if (
    request !== outputRequest ||
    commandVersion !== useLive.getState().commandVersion ||
    useShow.getState().librarySong?.songId !== songId ||
    (song &&
      song.songRevision < (useShow.getState().librarySong?.songRevision ?? 0))
  ) {
    return;
  }
  refreshLibrarySong(songId, song);
  if (!song) return;
  const slide = slideLayerOf(cursor, tilesOf);
  if (!slide) return;
  const current = useLive.getState().state?.layers.media;
  if (
    song.background &&
    (current?.mediaId !== song.background.mediaId ||
      current.loop !== song.background.loop)
  ) {
    sendLive({type: 'media.show', media: song.background});
  }
  sendLive({type: 'slide.show', slide});
}

function outputIfPresent(cursor: TileCursor | null): void {
  if (cursor) outputTile(cursor);
}

export function outputNext(): void {
  outputIfPresent(nextTile(sequenceState()));
}

export function outputPrevious(): void {
  outputIfPresent(previousTile(sequenceState()));
}

export function jumpLabelFor(code: string): string | undefined {
  const song = useShow.getState().librarySong;
  const source = liveCursor()?.itemId ?? useShow.getState().openItemId;
  if (song && source === librarySourceId(song.songId)) {
    return song.jumpKeys[code];
  }
  return useShow.getState().jumpKeys[code];
}

/** Outputs the first tile with an 이름표 after the live 장, or the first in the sequence. */
export function outputLabel(label: string): void {
  outputIfPresent(tileForLabel(sequenceState(), label));
}

function openAdjacentItem(direction: 'next' | 'previous'): void {
  const {rows, openItemId} = useShow.getState();
  const target = adjacentItem({
    rows,
    tilesOf,
    current: openItemId,
    direction,
  });
  if (target !== null) openItem(target);
}

/** 다음 항목: opens the next item that can output, without outputting. */
export function openNextItem(): void {
  openAdjacentItem('next');
}

/** 이전 항목: opens the previous item that can output, without outputting. */
export function openPreviousItem(): void {
  openAdjacentItem('previous');
}

/** 출력 중인 항목 열기: opens the item of the live 장 in the 장 panel. */
export function revealLiveItem(): void {
  const {rows, openItemId} = useShow.getState();
  const song = useShow.getState().librarySong;
  if (song && liveCursor()?.itemId === librarySourceId(song.songId)) {
    openItem(librarySourceId(song.songId));
    return;
  }
  const target = liveItem({rows, live: liveCursor(), current: openItemId});
  if (target !== null) openItem(target);
}

function isStale(service: ShowService): boolean {
  const {revision, serviceId} = useShow.getState();
  return (
    revision !== null && serviceId === service.id && service.revision < revision
  );
}

function keptSelection(
  service: ShowService,
): Pick<ShowView, 'openItemId' | 'selectedTile'> {
  const {openItemId, selectedTile} = useShow.getState();
  const song = useShow.getState().librarySong;
  if (song && openItemId === librarySourceId(song.songId)) {
    return {openItemId, selectedTile};
  }
  const stillThere =
    openItemId !== null &&
    service.rows.some(row => row.id === openItemId && row.kind !== 'header');
  if (!stillThere) return {openItemId: null, selectedTile: 0};
  const last = Math.max(0, (service.tiles[openItemId]?.length ?? 0) - 1);
  return {openItemId, selectedTile: Math.min(selectedTile, last)};
}

/**
 * Shows the open 예배 순서 the main process sent, or none when it is null. A
 * revision older than the one shown is dropped. The open item and the selected
 * tile stay when the item is still there.
 */
export function applyService(service: ShowService | null): void {
  if (service === null) {
    const {librarySong, openItemId, selectedTile} = useShow.getState();
    const keepLibrary =
      librarySong && openItemId === librarySourceId(librarySong.songId);
    useShow.setState({
      ...noService,
      openItemId: keepLibrary ? openItemId : null,
      selectedTile: keepLibrary ? selectedTile : 0,
    });
    return;
  }
  if (isStale(service)) return;
  useShow.setState({
    revision: service.revision,
    serviceId: service.id,
    serviceName: service.name,
    readOnly: service.readOnly,
    rows: service.rows,
    tiles: service.tiles,
    jumpKeys: service.jumpKeys,
    ...keptSelection(service),
  });
}

/**
 * Starts mirroring the open 예배 순서 of the main process. The first read is
 * dropped when a push already arrived, because the push is newer, and nothing
 * changes the state after the returned function was called.
 *
 * @returns A function that stops mirroring. Always call it.
 */
export function startServiceSync(): () => void {
  const api = window.llp;
  if (api === undefined) return () => undefined;
  let stopped = false;
  let pushed = false;
  const unsubscribe = api.service.subscribe(service => {
    if (stopped) return;
    pushed = true;
    applyService(service);
  });
  api.service.get().then(
    service => {
      if (stopped || pushed) return;
      applyService(service);
    },
    // NOTE(0913vision): The preload logs a failed or malformed read before it
    // rejects, so the view just stays as it is.
    () => undefined,
  );
  return () => {
    stopped = true;
    unsubscribe();
  };
}
