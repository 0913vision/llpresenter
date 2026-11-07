import {projectedItemOverlays} from '@core/services/songItemOverlays';
import {useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {
  SongPreviewFrame,
  type SongEditorStore,
} from '@renderer/features/songs/editor';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import {IconButton} from '@renderer/ui/IconButton';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import {
  Properties,
  PropertyGroup,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {ItemBackgroundRow, ItemMemo, ItemStartRow} from './ItemSettingsRows';
import {
  isStartItem,
  type ServiceItemStore,
  type StartItem,
} from './serviceItemStore';
import {itemPicture, shownPosition} from '../../songs/editor/songItemModel';
import {useShow} from '@renderer/session/show';
import {savedPassageTiles} from './bibleItemModel';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {openItemSong} from './openItemSong';
import {songUsage} from '@renderer/features/songs/editor/songUsage';
import {Tooltip} from '@renderer/ui/Tooltip';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {ItemThemeRow} from './ItemThemeRow';
import {SlidesPreview} from '../slides/SlidesVisuals';
import {useItemMedia} from './useItemSources';

const SETTINGS_TAB = [{value: 'settings', label: '항목 설정'}] as const;
const SAVING_REASON = '저장 중';

interface ItemPanelProps {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}

/** The selected place of the 준비 item, drawn locally; never the output. */
export function ItemPreviewPanel({items, editor}: ItemPanelProps): JSX.Element {
  const {service, item, song, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const rawTiles = useShow(view =>
    savedPassageTiles(
      view,
      service?.service.id,
      item !== null && isItemOfKind(item, 'bible') ? item.id : undefined,
    ),
  );
  const projection = useBibleTileProjection({
    itemId: item !== null && isItemOfKind(item, 'bible') ? item.id : null,
    ...(service === null ? {} : {serviceId: service.service.id}),
  });
  const tiles = projection?.tiles ?? rawTiles;
  const at = shownPosition(position, tiles.length);
  const tile = at === undefined ? undefined : tiles[at];
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const media = useItemMedia(
    editor.api.media,
    item !== null &&
      (isItemOfKind(item, 'slides') || isItemOfKind(item, 'media')),
  );
  const mediaFile =
    item !== null && isItemOfKind(item, 'media')
      ? media.document?.value.items.find(file => file.id === item.media)
      : undefined;
  const picture =
    item !== null && isItemOfKind(item, 'media')
      ? {
          itemId: item.id,
          mediaId: item.media,
          name: mediaFile?.name ?? '미디어 없음',
          position: 1,
          total: 1,
        }
      : item !== null &&
          isItemOfKind(item, 'bible') &&
          tile !== undefined &&
          at !== undefined
        ? {
            itemId: item.id,
            tile,
            next: tiles[at + 1],
            position: at + 1,
            total: tiles.length,
          }
        : item === null || !isItemOfKind(item, 'song') || song === null
          ? null
          : itemPicture({
              song: {...song.history.snapshot.song, slides: item.slides},
              position,
              background: item.background ?? song.background,
            });
  const previewKind =
    item === null
      ? undefined
      : isItemOfKind(item, 'song')
        ? 'song'
        : isItemOfKind(item, 'bible')
          ? 'bible'
          : isItemOfKind(item, 'media')
            ? 'media'
            : undefined;
  const previewTitle =
    item !== null && isItemOfKind(item, 'bible')
      ? item.bible.ref
      : song?.history.snapshot.song.title;
  if (item !== null && isItemOfKind(item, 'slides')) {
    return (
      <SlidesPreview
        api={editor.api}
        item={item}
        selected={Math.max(
          0,
          Math.min(position, item.slides.slides.length - 1),
        )}
        media={media.document?.value.items ?? []}
      />
    );
  }
  return (
    <SongPreviewFrame
      settings={editor.api.settings}
      labels={labels}
      picture={picture}
      item={
        item !== null && previewKind !== undefined
          ? {
              ...item,
              overlays: projectedItemOverlays(item),
              kind: previewKind,
              source: 'service',
              ...(previewTitle === undefined ? {} : {title: previewTitle}),
            }
          : undefined
      }
    />
  );
}

/** 항목 설정: where the item comes from and what this service sets for it. */
export function ItemSettingsPanel({
  items,
  editor,
}: ItemPanelProps): JSX.Element {
  const {service, item, song} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const editorState = useSyncExternalStore(
    editor.subscribe,
    editor.getSnapshot,
  );
  const usage =
    song === null
      ? null
      : songUsage(
          editorState.library,
          editorState.libraryStatus,
          song.document.song.id,
        );
  return (
    <Panel label="항목 설정">
      <PanelHeader>
        <PanelTabs
          tabs={SETTINGS_TAB}
          value="settings"
          onChange={() => undefined}
        />
      </PanelHeader>
      {service === null || item === null || !isStartItem(item) ? null : (
        <PanelBody>
          <Properties>
            {isItemOfKind(item, 'song') && song !== null ? (
              <PropertyGroup title="원본">
                <PropertyValue
                  label="곡"
                  value={song.document.song.title}
                  icon="link"
                  primary
                  action={
                    <IconButton
                      icon="open"
                      label={windowCommandLabels.editSong}
                      onClick={() => {
                        openItemSong({items, editor});
                      }}
                    />
                  }
                />
                {usage === null ? null : (
                  <Tooltip text={usage.tooltip}>
                    <div tabIndex={0}>
                      <PropertyValue label="쓰는 곳" value={usage.text} />
                    </div>
                  </Tooltip>
                )}
              </PropertyGroup>
            ) : null}
            <ThisService
              items={items}
              api={editor.api}
              item={item}
              song={song}
              lockReason={
                service.access === 'readOnly' ? NEWER_FILE_REASON : undefined
              }
            />
            <PropertyGroup title="메모" icon="note">
              <ItemMemo
                key={item.id}
                items={items}
                target={{serviceId: service.service.id, itemId: item.id}}
                saved={item.memo ?? ''}
                lockReason={
                  service.access === 'readOnly' ? NEWER_FILE_REASON : undefined
                }
              />
            </PropertyGroup>
          </Properties>
        </PanelBody>
      )}
    </Panel>
  );
}

function ThisService({
  items,
  api,
  item,
  song,
  lockReason,
}: {
  readonly items: ServiceItemStore;
  readonly api: SongEditorStore['api'];
  readonly item: StartItem;
  readonly song: SongSession | null;
  readonly lockReason: string | undefined;
}): JSX.Element {
  const {busy} = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const reason = lockReason ?? (busy ? SAVING_REASON : undefined);
  return (
    <PropertyGroup title="이번 예배">
      <ItemThemeRow
        api={api.settings}
        items={items}
        item={item}
        reason={reason}
      />
      {isItemOfKind(item, 'song') && song !== null ? (
        <ItemBackgroundRow
          items={items}
          api={api}
          lockReason={reason}
          item={item}
          session={song}
        />
      ) : null}
      {isItemOfKind(item, 'slides') ? (
        <ItemBackgroundRow
          items={items}
          api={api}
          lockReason={reason}
          item={item}
        />
      ) : null}
      <ItemStartRow
        items={items}
        api={api}
        lockReason={reason}
        macroId={item.macro}
      />
    </PropertyGroup>
  );
}
