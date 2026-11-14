import {useMemo, useSyncExternalStore, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItem} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {Button} from '@renderer/ui/Button';
import {
  isStartItem,
  type ServiceItemState,
  type ServiceItemStore,
} from '../items/serviceItemStore';
import {ItemThemeRow} from './ItemThemeRow';
import {ItemBackgroundRow, ItemMemo, ItemStartRow} from './ItemSettingsRows';
import type {useItemMedia} from '../items/useItemSources';
import {useServiceSongMenu} from '../order/useServiceSongMenu';
import {songUsage} from '@renderer/features/songs/editor/songUsage';
import {Tooltip} from '@renderer/ui/Tooltip';
import {ItemCardRow} from '../items/ItemCardRow';
import styles from './DetailsInfo.module.css';

interface DetailsInfoData {
  readonly item: ServiceItem | null;
  readonly service: ServiceDocument | null;
  readonly state: ServiceItemState;
  readonly library: ShowLibrarySong | null;
  readonly media: ReturnType<typeof useItemMedia>;
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly reason: string | undefined;
  readonly api: LlpApi;
  readonly openSource: () => void;
  readonly edit: (index: number) => void;
}

export function DetailsInfo({
  details,
}: {
  readonly details: DetailsInfoData;
}): JSX.Element {
  const {
    item,
    service,
    state,
    library,
    media,
    items,
    editor,
    reason,
    api,
    openSource,
    edit,
  } = details;
  const target = useMemo(
    () =>
      item !== null && isItemOfKind(item, 'song') && service !== null
        ? {id: item.id, serviceId: service.service.id, api}
        : null,
    [api, item, service],
  );
  const transfer = useServiceSongMenu(target, items.reportNotice, undefined);
  const editorState = useSyncExternalStore(
    editor.subscribe,
    editor.getSnapshot,
  );
  const songId =
    item !== null && isItemOfKind(item, 'song') ? item.song : library?.songId;
  const usage =
    songId === undefined
      ? null
      : songUsage(editorState.library, editorState.libraryStatus, songId);
  const transferReason =
    reason ?? transfer.reason ?? (transfer.locked ? '저장 중' : undefined);
  return (
    <>
      <Properties className={styles.properties}>
        {item !== null && service !== null && isStartItem(item) ? (
          <PropertyGroup title="이번 예배">
            <ItemThemeRow
              api={editor.api.settings}
              items={items}
              item={item}
              reason={reason}
            />
            {isItemOfKind(item, 'song') && state.song !== null ? (
              <ItemBackgroundRow
                items={items}
                api={editor.api}
                lockReason={reason}
                item={item}
                session={state.song}
              />
            ) : isItemOfKind(item, 'slides') ? (
              <ItemBackgroundRow
                items={items}
                api={editor.api}
                lockReason={reason}
                item={item}
              />
            ) : null}
            <ItemStartRow
              items={items}
              api={editor.api}
              lockReason={reason}
              macroId={item.macro}
            />
            <ItemCardRow items={items} item={item} reason={reason} />
            <PropertyRow label="메모" alignTop>
              {() => (
                <ItemMemo
                  key={item.id}
                  items={items}
                  target={{
                    serviceId: service.service.id,
                    itemId: item.id,
                  }}
                  saved={item.memo ?? ''}
                  lockReason={reason}
                />
              )}
            </PropertyRow>
          </PropertyGroup>
        ) : null}
        {item !== null && isItemOfKind(item, 'song') ? (
          <PropertyGroup title="원본">
            <PropertyValue
              label="곡"
              value={state.song?.document.song.title ?? '없는 곡'}
              action={
                <Button
                  disabled={state.song === null}
                  title={
                    state.song === null ? '곡을 찾을 수 없습니다' : undefined
                  }
                  onClick={openSource}
                >
                  열기
                </Button>
              }
            />
            {usage === null ? null : (
              <Tooltip text={usage.tooltip}>
                <div tabIndex={0}>
                  <PropertyValue label="쓰는 곳" value={usage.text} />
                </div>
              </Tooltip>
            )}
            <PropertyRow label="라이브러리에 저장">
              {() => (
                <Button
                  className={styles.button}
                  disabled={transferReason !== undefined}
                  title={transferReason}
                  onClick={transfer.save}
                >
                  라이브러리에 저장…
                </Button>
              )}
            </PropertyRow>
            <PropertyRow label="다시 불러오기">
              {() => (
                <Button
                  className={styles.button}
                  disabled={transferReason !== undefined}
                  title={transferReason}
                  onClick={transfer.reload}
                >
                  라이브러리에서 다시 불러오기
                </Button>
              )}
            </PropertyRow>
          </PropertyGroup>
        ) : library !== null ? (
          <PropertyGroup title="원본">
            {usage === null ? null : (
              <Tooltip text={usage.tooltip}>
                <div tabIndex={0}>
                  <PropertyValue label="쓰는 곳" value={usage.text} />
                </div>
              </Tooltip>
            )}
          </PropertyGroup>
        ) : item !== null && isItemOfKind(item, 'bible') ? (
          <PropertyGroup title="원본">
            <PropertyValue
              label="성경"
              value={item.bible.translation}
              action={<Button onClick={() => edit(0)}>열기</Button>}
            />
          </PropertyGroup>
        ) : item !== null &&
          isItemOfKind(item, 'slides') &&
          service !== null ? (
          <PropertyGroup title="원본">
            <PropertyValue
              label="예배 순서"
              value={service.service.name}
              action={<Button onClick={() => edit(0)}>열기</Button>}
            />
          </PropertyGroup>
        ) : item !== null && isItemOfKind(item, 'media') ? (
          <PropertyGroup title="원본">
            <PropertyValue
              label="미디어"
              value={
                media.document?.value.items.find(file => file.id === item.media)
                  ?.name ?? '미디어 없음'
              }
            />
          </PropertyGroup>
        ) : null}
      </Properties>
      {transfer.dialog}
    </>
  );
}
