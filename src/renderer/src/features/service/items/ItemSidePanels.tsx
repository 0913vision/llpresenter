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
import {NEWER_FILE_REASON} from './ItemArrangement';
import {ItemBackgroundRow, ItemMemo, ItemStartRow} from './ItemSettingsRows';
import {
  isStartItem,
  type ServiceItemStore,
  type StartItem,
} from './serviceItemStore';
import {itemPicture, shownPosition} from './songItemModel';
import {useShow} from '@renderer/state/show';
import {savedPassageTiles} from './bibleItemModel';

const SETTINGS_TAB = [{value: 'settings', label: '항목 설정'}] as const;
const SAVING_REASON = '저장 중';

interface ItemPanelProps {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}

/** The selected place of the 준비 item, drawn locally; never the output. */
export function ItemPreviewPanel({items, editor}: ItemPanelProps): JSX.Element {
  const {service, item, song, arrangement, position} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const tiles = useShow(view =>
    savedPassageTiles(
      view,
      service?.service.id,
      item !== null && isItemOfKind(item, 'bible') ? item.id : undefined,
    ),
  );
  const at = shownPosition(position, tiles.length);
  const tile = at === undefined ? undefined : tiles[at];
  const labels =
    useSyncExternalStore(editor.subscribe, editor.getSnapshot).labels?.value
      .labels ?? [];
  const picture =
    item !== null &&
    isItemOfKind(item, 'bible') &&
    tile !== undefined &&
    at !== undefined
      ? {itemId: item.id, tile, position: at + 1, total: tiles.length}
      : item === null || !isItemOfKind(item, 'song') || song === null
        ? null
        : itemPicture({
            song: song.history.snapshot.song,
            arrangement,
            position,
            background: item.background ?? song.background,
          });
  return (
    <SongPreviewFrame
      settings={editor.api.settings}
      labels={labels}
      picture={picture}
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
                  meta="라이브러리"
                  action={
                    <IconButton
                      icon="open"
                      label="라이브러리 곡 열기"
                      onClick={() => {
                        editor.open(song.document);
                      }}
                    />
                  }
                />
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
      {isItemOfKind(item, 'song') && song !== null ? (
        <ItemBackgroundRow
          items={items}
          api={api}
          lockReason={reason}
          item={item}
          session={song}
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
