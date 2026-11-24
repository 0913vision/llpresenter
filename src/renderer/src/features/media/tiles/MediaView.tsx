import {EmptyState} from '@renderer/ui/lists/EmptyState';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useMemo, type JSX} from 'react';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {mediaLoops} from '@core/media';
import {type MediaItem, MEDIA_LIMITS} from '@core/schema/media/mediaList';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {useLive} from '@renderer/session/live';
import {Button} from '@renderer/ui/buttons/Button';
import {MediaTile} from '@renderer/ui/tiles/MediaTile';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelTabs,
} from '@renderer/ui/panels/Panel';
import {Slider} from '@renderer/ui/choices/Slider';
import {Menu} from '@renderer/ui/menus/Menu';
import {ViewModeSwitch} from '@renderer/ui/choices/ViewModeSwitch';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  UNNAMED_PLAYLIST,
  durationText,
  mediaEntries,
  totalText,
  type ChosenPlaylist,
  type MediaEntry,
} from '../mediaEntries';
import {useMediaImportCompletion, useMediaView} from '../MediaViewProvider';
import {VirtualMediaGrid} from './VirtualMediaGrid';
import {writeMediaDrag} from '../mediaDrag';
import {useMediaImportAction} from '../import/useMediaImportAction';
import {useMediaFileDrop} from '../import/useMediaFileDrop';
import {
  DEFAULT_MEDIA_COLUMNS,
  MAX_MEDIA_COLUMNS,
  MIN_MEDIA_COLUMNS,
  useMediaLayout,
} from './useMediaLayout';
import {useMediaPicks} from './useMediaPicks';
import {useMediaShortcuts} from './useMediaShortcuts';
import type {MediaLibrary} from '../mediaLibrary';
import styles from './MediaView.module.css';
import {entryName, useMediaActions} from './useMediaActions';

export interface MediaViewProps {
  readonly workspace?: 'show' | 'prep';
  /** The workspace host merges problems into its one notification list. */
  readonly onProblem: (notice: Notice) => void;
  readonly onCollapse?: ((button: HTMLButtonElement) => void) | undefined;
}

function playlistRef(playlist: ChosenPlaylist) {
  return playlist.kind === 'media'
    ? ({kind: 'media', id: playlist.id} as const)
    : ({kind: 'audio', id: playlist.id} as const);
}

function EntryTile({
  entry,
  missing,
  live,
  selected,
  display,
}: {
  readonly entry: MediaEntry;
  readonly display: 'grid' | 'list';
  readonly missing: boolean;
  readonly live: boolean;
  readonly selected: boolean;
}): JSX.Element {
  if (entry.kind === 'copy') {
    return (
      <MediaTile
        name={entryName(entry)}
        copying={entry.job.percent}
        view={display}
      />
    );
  }
  const {item, copying} = entry;
  const showsPicture = item.kind !== 'audio' && !missing;
  return (
    <MediaTile
      view={display}
      name={entryName(entry)}
      picture={showsPicture ? thumbnailSrc(item.id) : undefined}
      duration={item.kind === 'image' ? undefined : durationText(item.duration)}
      loop={item.kind === 'video' && mediaLoops(item)}
      copying={copying}
      missingFile={missing ? item.file : undefined}
      live={live}
      selected={selected}
      onDragStart={
        copying === undefined
          ? event => writeMediaDrag(event.dataTransfer, item.id)
          : undefined
      }
    />
  );
}

/**
 * The center of the media view in 준비 (spec 05, "Media view"): the list the
 * playlist panels chose, as a grid of tiles, 가져오기 into it with each file's
 * copy progress, and the size slider. In 준비, a click selects and a double
 * click outputs. In 진행, a click outputs without changing selection.
 * A missing file's tile opens 다시 연결.
 */
export function MediaView({
  onProblem,
  workspace = 'prep',
  onCollapse,
}: MediaViewProps): JSX.Element {
  const {library, view, choice, selected, select: setSelected} = useMediaView();
  const imported = useMediaImportCompletion();
  const {display, columns, changeDisplay, changeColumns} = useMediaLayout();
  const entries = useMemo(() => mediaEntries(view, choice), [view, choice]);
  const picks = useMediaPicks({entries, selected, setSelected});
  const actions = useMediaActions({entries, picks, workspace, onProblem});
  const {playlist, missing, renaming} = actions;
  const liveId = useLive(state => state.state?.layers.media?.mediaId);
  const title =
    playlist === null ? '모든 미디어' : playlist.name || UNNAMED_PLAYLIST;
  const items = entries.flatMap(entry =>
    entry.kind === 'media' ? [entry.item] : [],
  );
  const {index, select} = picks;
  const selectedItem =
    entries[index]?.kind === 'media' ? entries[index].item : undefined;
  const copyReason =
    view.document?.access === 'editable' ? undefined : NEWER_FILE_REASON;
  useMediaShortcuts({
    title,
    selected: selectedItem,
    reason: copyReason,
    remove: actions.deleteItem,
    duplicate: actions.duplicateMedia,
  });
  const {
    reason: importReason,
    startImport,
    isPending,
  } = useMediaImportAction(view.document, async files => {
    const destination = playlist === null ? null : playlistRef(playlist);
    const jobs = await (files === undefined
      ? library.import(destination)
      : library.importFiles(files, destination));
    imported(jobs ?? [], choice);
  });
  const {dragOver, drop} = useMediaFileDrop({
    reason: importReason,
    isPending,
    startImport,
  });
  return (
    <>
      <Panel label="미디어 보기" className={styles.panel}>
        <PanelHeader>
          <PanelTabs
            tabs={[{value: 'list', label: title}]}
            value="list"
            onChange={() => undefined}
          />
          <PanelActions>
            <Button
              icon="download"
              disabled={importReason !== undefined}
              title={importReason}
              onClick={() => startImport()}
            >
              가져오기
            </Button>
            {onCollapse === undefined ? null : (
              <Button
                icon="down"
                aria-label="미디어 접기"
                aria-expanded={true}
                data-media-toggle
                title="미디어 접기"
                onClick={event => onCollapse(event.currentTarget)}
              >
                접기
              </Button>
            )}
          </PanelActions>
        </PanelHeader>
        <PanelBody tab="list" className={styles.body}>
          {view.document !== null && entries.length === 0 ? (
            <div
              className={styles.emptyDrop}
              onDragOver={dragOver}
              onDrop={drop}
            >
              <EmptyState
                text="미디어 없음"
                action={
                  <Button
                    icon="download"
                    disabled={importReason !== undefined}
                    title={importReason}
                    onClick={() => startImport()}
                  >
                    가져오기
                  </Button>
                }
              />
            </div>
          ) : null}
          <VirtualMediaGrid
            workspace={workspace}
            onDragOver={dragOver}
            onDrop={drop}
            label={title}
            count={entries.length}
            ids={entries.map(entry => entry.id)}
            columns={columns ?? DEFAULT_MEDIA_COLUMNS}
            view={display}
            fitHeight={display === 'grid' && columns === undefined}
            selected={index < 0 ? undefined : index}
            onSelect={at => select(entries[at]?.id ?? null)}
            onPick={picks.pick}
            onActivate={actions.activate}
            onOutput={workspace === 'show' ? () => undefined : actions.output}
            onMenu={actions.openMenu}
            tile={at => {
              const entry = entries[at];
              return entry === undefined ? null : (
                <EntryTile
                  key={entry.id}
                  entry={entry}
                  display={display}
                  missing={missing(entry)}
                  live={liveId === entry.id}
                  selected={picks.isChosen(entry.id)}
                />
              );
            }}
          />
        </PanelBody>
        <PanelFooter
          end={
            <>
              <ViewModeSwitch
                label="미디어 보기 방식"
                value={display}
                onChange={changeDisplay}
              />
              <Slider
                label="타일 크기"
                disabled={display === 'list'}
                title={display === 'list' ? '격자 보기에서 조절' : undefined}
                workspace={workspace}
                icon="grid"
                width="compact"
                min={MIN_MEDIA_COLUMNS}
                max={MAX_MEDIA_COLUMNS}
                step={1}
                value={
                  MIN_MEDIA_COLUMNS +
                  MAX_MEDIA_COLUMNS -
                  (columns ?? DEFAULT_MEDIA_COLUMNS)
                }
                valueText={columns === undefined ? '자동 크기' : `${columns}열`}
                onChange={size =>
                  changeColumns(MIN_MEDIA_COLUMNS + MAX_MEDIA_COLUMNS - size)
                }
              />
            </>
          }
        >
          {totalText(items)}
        </PanelFooter>
      </Panel>
      {actions.menu === null ? null : (
        <Menu
          context
          label="미디어 메뉴"
          anchor={actions.menu.anchor}
          onClose={actions.closeMenu}
          entries={actions.menu.entries}
        />
      )}
      {renaming === null ? null : (
        <MediaRenameDialog
          item={renaming}
          onClose={actions.closeRenaming}
          onCommit={name => library.rename(renaming.id, name)}
        />
      )}
    </>
  );
}

function MediaRenameDialog({
  item,
  onClose,
  onCommit,
}: {
  readonly item: MediaItem;
  readonly onClose: () => void;
  readonly onCommit: (name: string) => ReturnType<MediaLibrary['rename']>;
}): JSX.Element {
  return (
    <RenameDialog
      title="미디어 이름 바꾸기"
      label="미디어 이름"
      name={item.name}
      rename={{
        maxLength: MEDIA_LIMITS.name,
        onClose,
        onCommit,
      }}
    />
  );
}
