import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {thumbnailUrl} from '@shared/media';
import {mediaLoops} from '@shared/mediaEndRule';
import type {MediaId} from '@shared/schema/ids';
import {sendLive, useLive} from '@renderer/state/live';
import {
  Button,
  MediaTile,
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelMeta,
  PanelTabs,
  Slider,
} from '@renderer/ui';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {MediaLibrary, type MediaApi} from './mediaLibrary';
import {
  durationText,
  mediaEntries,
  totalText,
  type MediaEntry,
} from './mediaEntries';
import {VirtualMediaGrid} from './VirtualMediaGrid';
import styles from './MediaView.module.css';

/** The fewest and most grid columns the size slider sets. */
export const MIN_MEDIA_COLUMNS = 2;
export const MAX_MEDIA_COLUMNS = 8;
export const DEFAULT_MEDIA_COLUMNS = 5;

export const UNNAMED_MEDIA = '이름 없는 미디어';

export interface MediaViewProps {
  readonly api: MediaApi;
  /** The workspace host merges problems into its one notification list. */
  readonly onProblem: (notice: Notice) => void;
}

interface OpenMenu {
  readonly entries: readonly MenuEntry[];
  readonly anchor: MenuAnchor;
}

function useMediaLibrary(
  api: MediaApi,
  onProblem: (notice: Notice) => void,
): MediaLibrary {
  const report = useEffectEvent(onProblem);
  const [library] = useState(() => new MediaLibrary(api));
  useEffect(
    () =>
      library.start(notice => {
        report(notice);
      }),
    [library],
  );
  return library;
}

function nameOf(entry: MediaEntry): string {
  return entry.kind === 'copy'
    ? entry.job.fileName
    : entry.item.name || UNNAMED_MEDIA;
}

function EntryTile({
  entry,
  missing,
  live,
  selected,
}: {
  readonly entry: MediaEntry;
  readonly missing: boolean;
  readonly live: boolean;
  readonly selected: boolean;
}): JSX.Element {
  if (entry.kind === 'copy') {
    return <MediaTile name={nameOf(entry)} copying={entry.job.percent} />;
  }
  const {item, copying} = entry;
  const showsPicture = item.kind !== 'audio' && !missing;
  return (
    <MediaTile
      name={nameOf(entry)}
      picture={showsPicture ? thumbnailUrl(item.id) : undefined}
      duration={item.kind === 'image' ? undefined : durationText(item.duration)}
      loop={item.kind === 'video' && mediaLoops(item)}
      copying={copying}
      missingFile={missing ? item.file : undefined}
      live={live}
      selected={selected}
    />
  );
}

/**
 * The media view of 준비 (spec 05, "Media view"): 모든 미디어 as a grid of
 * tiles, 가져오기 with each file's copy progress, and the size slider. A click
 * selects a tile, a double click outputs it as the background, and a missing
 * file's tile opens 다시 연결.
 */
export function MediaView({api, onProblem}: MediaViewProps): JSX.Element {
  const library = useMediaLibrary(api, onProblem);
  const view = useSyncExternalStore(library.subscribe, library.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [columns, setColumns] = useState(DEFAULT_MEDIA_COLUMNS);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [importing, setImporting] = useState(false);
  const liveId = useLive(state => state.state?.layers.media?.mediaId);
  const entries = useMemo(
    () => mediaEntries(view.document, view.jobs),
    [view.document, view.jobs],
  );
  const items = view.document?.value.items ?? [];
  const index = entries.findIndex(({id}) => id === selected);
  const missing = (entry: MediaEntry): boolean =>
    entry.kind === 'media' && view.missing.has(entry.item.id);

  const relink = (mediaId: MediaId, name: string): void => {
    library.relink(mediaId, name).catch((cause: unknown) => {
      console.error('Media relink failed:', cause);
    });
  };
  const activate = (at: number): void => {
    const entry = entries[at];
    if (entry === undefined || entry.kind === 'copy') return;
    if (missing(entry)) relink(entry.item.id, nameOf(entry));
    else setSelected(entry.id);
  };
  const output = (at: number): void => {
    const entry = entries[at];
    if (
      entry?.kind !== 'media' ||
      entry.item.kind === 'audio' ||
      entry.copying !== undefined ||
      missing(entry)
    ) {
      return;
    }
    try {
      sendLive({
        type: 'media.show',
        media: {mediaId: entry.item.id, loop: mediaLoops(entry.item)},
      });
    } catch (cause: unknown) {
      console.error('Media output failed:', cause);
      onProblem({
        key: 'media-view:output',
        kind: 'warning',
        icon: 'warning',
        title: '미디어를 내보내지 못함',
        time: noticeTime(),
      });
    }
  };
  const actions = (entry: MediaEntry): TileActions => ({
    missing: missing(entry),
    cancel: mediaId => {
      library.cancel(mediaId, nameOf(entry)).catch((cause: unknown) => {
        console.error('Stopping a media copy failed:', cause);
      });
    },
    relink: mediaId => relink(mediaId, nameOf(entry)),
  });
  const startImport = (): void => {
    setImporting(true);
    library
      .import(null)
      .catch((cause: unknown) => {
        console.error('Media import failed:', cause);
      })
      .finally(() => {
        setImporting(false);
      });
  };
  return (
    <>
      <Panel label="미디어" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={[{value: 'all', label: '모든 미디어'}]}
            value="all"
            onChange={() => undefined}
          />
          <PanelMeta>{items.length}</PanelMeta>
          <PanelActions>
            <Button icon="upload" disabled={importing} onClick={startImport}>
              가져오기
            </Button>
          </PanelActions>
        </PanelHeader>
        <PanelBody tab="all" className={styles.body}>
          <VirtualMediaGrid
            label="모든 미디어"
            count={entries.length}
            columns={columns}
            selected={index < 0 ? undefined : index}
            onSelect={at => setSelected(entries[at]?.id ?? null)}
            onActivate={activate}
            onOutput={output}
            onMenu={(at, anchor) => {
              const entry = entries[at];
              const choices =
                entry === undefined ? [] : menuEntries(entry, actions(entry));
              if (choices.length > 0) setMenu({entries: choices, anchor});
            }}
            tile={at => {
              const entry = entries[at];
              return entry === undefined ? null : (
                <EntryTile
                  key={entry.id}
                  entry={entry}
                  missing={missing(entry)}
                  live={liveId === entry.id}
                  selected={selected === entry.id}
                />
              );
            }}
          />
        </PanelBody>
        <PanelFooter
          end={
            <Slider
              label="타일 크기"
              icon="grid"
              width="compact"
              min={MIN_MEDIA_COLUMNS}
              max={MAX_MEDIA_COLUMNS}
              step={1}
              value={MIN_MEDIA_COLUMNS + MAX_MEDIA_COLUMNS - columns}
              valueText={`${columns}열`}
              onChange={size =>
                setColumns(MIN_MEDIA_COLUMNS + MAX_MEDIA_COLUMNS - size)
              }
            />
          }
        >
          {totalText(items)}
        </PanelFooter>
      </Panel>
      {menu === null ? null : (
        <Menu
          label="미디어 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={menu.entries}
        />
      )}
    </>
  );
}

interface TileActions {
  readonly missing: boolean;
  readonly cancel: (mediaId: MediaId) => void;
  readonly relink: (mediaId: MediaId) => void;
}

// NOTE(0913vision): A copying tile offers only 복사 멈추기 (MediaTile README),
// and a missing file's tile 다시 연결.
function menuEntries(
  entry: MediaEntry,
  {missing, cancel, relink}: TileActions,
): readonly MenuEntry[] {
  const copying =
    entry.kind === 'copy'
      ? entry.job.mediaId
      : entry.copying === undefined
        ? null
        : entry.item.id;
  if (copying !== null) {
    return [
      {
        kind: 'item',
        id: 'cancel',
        label: '복사 멈추기',
        icon: 'stop',
        onSelect: () => cancel(copying),
      },
    ];
  }
  if (entry.kind !== 'media' || !missing) return [];
  return [
    {
      kind: 'item',
      id: 'relink',
      label: '다시 연결',
      icon: 'link',
      onSelect: () => relink(entry.item.id),
    },
  ];
}
