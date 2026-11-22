import {requestSongEditor} from '@renderer/features/songs/editor/songEditorRequests';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {hasSectionCard} from '@core/services/sectionCards';
import {slideLayerOf} from '@core/presentation/slideLayer';
import type {ServiceItemId, SongId} from '@core/schema/ids';
import type {LlpApi} from '@contracts/ipc/api';
import {noticeTime} from '@renderer/ui/notices';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {stageSlideOf, useShow} from '@renderer/session/show';
import {itemThemes, useThemeSettings} from '@renderer/pictures/itemThemes';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {BibleLoadNotice} from '@renderer/features/bible/BibleLoadNotice';
import {Panel, PanelBody, PanelTabs} from '@renderer/ui/Panel';
import {GridFooter} from '@renderer/ui/GridFooter';
import {Button} from '@renderer/ui/Button';
import {Spinner} from '@renderer/ui/Spinner';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {useItemMedia} from '../items/useItemSources';
import {useItemSettings} from '../items/useItemSources';
import {
  detailsHeading,
  detailsKindLine,
  sectionItemCount,
} from './detailsHeading';
import {DetailsInfo} from './DetailsInfo';
import {useItemTheme} from './ItemThemeRow';
import {DetailsSlides} from './DetailsSlides';
import {SlidePreview, usePreviewScreen} from './SlidePreview';
import {detailsScale} from '@renderer/platform/thumbnailScale';
import styles from './DetailsPanel.module.css';

type Target =
  | {readonly kind: 'item'; readonly itemId: ServiceItemId}
  | {readonly kind: 'song'; readonly songId: SongId};
const tabs = [
  {value: 'info', label: '정보'},
  {value: 'slides', label: '슬라이드'},
] as const;

function DetailsShell({
  children,
  footer,
}: {
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}): JSX.Element {
  return (
    <Panel label="세부정보" className={styles.panel}>
      <PanelBody>{children}</PanelBody>
      {footer}
    </Panel>
  );
}

function openEditor(
  request: () => Promise<{readonly ok: boolean}>,
  notice: () => void,
): void {
  request().then(result => {
    if (!result.ok) notice();
  }, notice);
}

/** Local details of the selected source; selecting a slide never changes output. */
interface DetailsPanelProps {
  readonly target: Target | null;
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly api: LlpApi;
  readonly sizeClass: SizeClass;
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
}

export function DetailsPanel(props: DetailsPanelProps): JSX.Element {
  return <DetailsPanelContent {...props} />;
}

function DetailsPanelContent({
  target,
  items,
  editor,
  api,
  sizeClass,
  onOpenPrep,
}: DetailsPanelProps): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const scale = detailsScale.use(sizeClass);
  const itemId = target?.kind === 'item' ? target.itemId : null;
  const listed = useShow(
    view => itemId !== null && view.rows.some(row => row.id === itemId),
  );
  useEffect(() => {
    items.show(
      itemId !== null && serviceId !== null ? {serviceId, itemId} : null,
    );
    return () => items.show(null);
  }, [items, serviceId, itemId]);
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const service = state.service;
  const media = useItemMedia(editor.api.media);
  const detailsKey =
    target === null
      ? 'none'
      : target.kind === 'item'
        ? `item:${target.itemId}`
        : `song:${target.songId}`;
  const [tabState, setTabState] = useState<{
    key: string;
    value: 'info' | 'slides';
  }>({key: detailsKey, value: 'info'});
  const tab = tabState.key === detailsKey ? tabState.value : 'info';
  const [loadedLibrary, setLibrary] = useState<ShowLibrarySong | null>(null);
  const targetKey = target?.kind === 'song' ? target.songId : null;
  const [selection, setSelection] = useState<{
    key: SongId | null;
    index: number;
  }>({key: null, index: 0});
  const selected = selection.key === targetKey ? selection.index : 0;
  const songId = target?.kind === 'song' ? target.songId : null;
  useEffect(() => {
    let active = true;
    if (songId !== null) {
      api.library
        .showSong({songId})
        .then(value => {
          if (active) setLibrary(value);
        })
        .catch(() => {
          if (active) {
            items.reportNotice({
              key: 'details:library',
              kind: 'warning',
              icon: 'warning',
              title: '곡 불러오기 실패',
              time: noticeTime(),
            });
          }
        });
    }
    return () => {
      active = false;
    };
  }, [api, items, songId]);
  const library = loadedLibrary?.songId === songId ? loadedLibrary : null;
  const item =
    target?.kind === 'item' && state.item?.id === target.itemId
      ? state.item
      : null;
  const themeData = useItemTheme(api.settings, item);
  const showRow = useShow(view =>
    item === null ? undefined : view.rows.find(row => row.id === item.id),
  );
  const passageProblem =
    showRow?.kind !== 'header' &&
    (showRow?.problem === 'missing-bible' ||
      showRow?.problem === 'loading-bible')
      ? showRow
      : undefined;
  const projectedTiles = useShow(view =>
    item === null ? undefined : view.tiles[item.id],
  );
  const tiles = library?.tiles ?? projectedTiles ?? [];
  const offset = item !== null && hasSectionCard(item) ? 1 : 0;
  const screenSettings = useItemSettings(api.settings, 'screens');
  const screens =
    screenSettings.document?.name === 'screens'
      ? screenSettings.document.value.screens
      : [];
  const previewScreen = usePreviewScreen(screens);
  const settings = useThemeSettings({
    api,
    role: previewScreen.target?.kind ?? 'audience',
    screenId: previewScreen.target?.id,
    source: library === null ? 'service' : 'external',
  });
  const themes = itemThemes(
    library === null
      ? showRow
      : {
          id: library.songId,
          kind: 'song',
          title: library.title,
          ...(library.background === undefined
            ? {}
            : {background: library.background}),
        },
    tiles,
    settings,
  );
  const {title, kind, count} = detailsHeading({
    item: item !== null && isItemOfKind(item, 'header') ? null : item,
    song: state.song,
    library,
    count: tiles.length,
    mediaTitle:
      item !== null && isItemOfKind(item, 'media')
        ? media.document?.value.items.find(file => file.id === item.media)?.name
        : undefined,
  });
  const detailsIds = tiles.map(
    (tile, index) => tile.key ?? tile.sourceSlide?.slideId ?? String(index),
  );
  const picture = (index: number): JSX.Element | undefined => {
    const tile = tiles[index];
    if (tile === undefined) return undefined;
    const itemId = item?.id ?? library?.songId ?? '';
    return (
      <TilePicture
        tile={tile}
        slide={
          (item === null ? null : stageSlideOf({itemId, index})) ??
          slideLayerOf({itemId, index}, () => tiles)
        }
        themes={themes}
      />
    );
  };
  const labelAt = (index: number): string | undefined => {
    const tile = tiles[index];
    return tile?.slideLabel ?? tile?.label ?? undefined;
  };
  const labelColorAt = (index: number) => tiles[index]?.labelColor ?? 'none';
  const select = (index: number): void => {
    if (item !== null) items.selectPosition(index);
    else setSelection({key: targetKey, index});
  };
  const edit = (index: number): void => {
    const fail = (): void =>
      items.reportNotice({
        key: 'details:editor',
        kind: 'warning',
        icon: 'warning',
        title: '편집 열기 실패',
        time: noticeTime(),
      });
    if (item !== null && isItemOfKind(item, 'song')) {
      if (service === null) return;
      openEditor(
        () =>
          requestSongEditor({
            songId: item.song,
            block: Math.max(0, index - offset),
            from: {serviceId: service.service.id, itemId: item.id},
          }),
        fail,
      );
    } else if (
      item !== null &&
      isItemOfKind(item, 'slides') &&
      service !== null
    ) {
      openEditor(
        () =>
          api.slidesEditor.open({
            serviceId: service.service.id,
            itemId: item.id,
          }),
        fail,
      );
    } else if (
      item !== null &&
      (isItemOfKind(item, 'bible') ||
        isItemOfKind(item, 'sermon') ||
        isItemOfKind(item, 'media') ||
        isItemOfKind(item, 'liturgy'))
    ) {
      items.selectPosition(index);
      onOpenPrep?.(item.id);
    } else if (library !== null) {
      openEditor(
        () =>
          requestSongEditor({
            songId: library.songId,
            block: index,
          }),
        fail,
      );
    }
  };
  const reason =
    state.service?.access === 'readOnly'
      ? NEWER_FILE_REASON
      : state.busy
        ? '저장 중'
        : undefined;
  const openSource = (): void => {
    if (item === null || !isItemOfKind(item, 'song')) return;
    const fail = (): void =>
      items.reportNotice({
        key: 'details:source',
        kind: 'warning',
        icon: 'warning',
        title: '곡 열기 실패',
        time: noticeTime(),
      });
    openEditor(() => requestSongEditor({songId: item.song}), fail);
  };
  if (item === null && library === null) {
    const deleted =
      target?.kind === 'item' &&
      service !== null &&
      service.service.id === serviceId &&
      !service.service.order.some(row => row.id === target.itemId) &&
      // NOTE(0913vision): A removed item's row leaves the list a moment after
      // the item leaves the service; the panel empties with the row.
      !listed;
    return (
      <DetailsShell>
        {target !== null && !deleted ? <Spinner size="sm" /> : null}
      </DetailsShell>
    );
  }
  if (item !== null && isItemOfKind(item, 'header')) {
    const itemCount = sectionItemCount(service?.service.order ?? [], item.id);
    return (
      <DetailsShell>
        <div className={styles.title} title={item.header}>
          {item.header}
        </div>
        <div className={styles.meta}>구역, 항목 {itemCount}개</div>
      </DetailsShell>
    );
  }
  const selectedIndex = Math.min(
    Math.max(0, count - 1),
    item === null ? selected : state.position,
  );
  return (
    <DetailsShell
      footer={
        tab === 'slides' ? (
          <GridFooter
            count={count}
            zoom={
              <ThumbnailSizeControl
                compact
                value={scale}
                onChange={value => detailsScale.show(sizeClass, value)}
                onCommit={value => detailsScale.save(sizeClass, value, api.ui)}
              />
            }
          />
        ) : null
      }
    >
      <SlidePreview
        picture={
          passageProblem === undefined ? (
            picture(selectedIndex)
          ) : (
            <BibleLoadNotice row={passageProblem} />
          )
        }
        screen={previewScreen}
        number={count === 0 ? undefined : selectedIndex + 1}
        label={labelAt(selectedIndex)}
        color={labelColorAt(selectedIndex)}
      />
      <div className={styles.title} title={title}>
        {title}
      </div>
      <div className={styles.meta}>
        {title === '' || passageProblem !== undefined
          ? ''
          : detailsKindLine(item, kind, count)}
      </div>
      {onOpenPrep !== undefined &&
      item !== null &&
      (isItemOfKind(item, 'bible') ||
        isItemOfKind(item, 'sermon') ||
        isItemOfKind(item, 'media')) ? (
        <Button icon="edit" onClick={() => edit(selectedIndex)}>
          편집
        </Button>
      ) : null}
      <PanelTabs
        tabs={tabs}
        value={tab}
        onChange={value => setTabState({key: detailsKey, value})}
      />
      {tab === 'info' ? (
        <DetailsInfo
          details={{
            item,
            service,
            state,
            library,
            media,
            themeData,
            items,
            editor,
            reason,
            api,
            openSource,
            edit,
          }}
        />
      ) : (
        <DetailsSlides
          count={count}
          ids={detailsIds}
          scope={detailsKey}
          scale={scale}
          selected={selectedIndex}
          onSelect={select}
          onEdit={edit}
          labelAt={labelAt}
          colorAt={labelColorAt}
          picture={picture}
        />
      )}
    </DetailsShell>
  );
}
