import {useEffect, useState, useSyncExternalStore, type JSX} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {hasSectionCard} from '@core/services/sectionCards';
import type {ServiceItemId, SongId} from '@core/schema/ids';
import type {LlpApi} from '@contracts/ipc/api';
import {noticeTime} from '@renderer/ui/notices';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {useShow} from '@renderer/session/show';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {Panel, PanelBody, PanelTabs} from '@renderer/ui/Panel';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {useItemSlides} from '../items/useItemSlides';
import {useItemMedia} from '../items/useItemSources';
import {slideBand} from '../slides/SlidesVisuals';
import {detailsHeading, sectionItemCount} from './detailsHeading';
import {detailsPicture} from './detailsPicture';
import {DetailsInfo} from './DetailsInfo';
import {DetailsSlides} from './DetailsSlides';
import styles from './DetailsPanel.module.css';

type Target =
  | {readonly kind: 'item'; readonly itemId: ServiceItemId}
  | {readonly kind: 'song'; readonly songId: SongId};
const tabs = [
  {value: 'info', label: '정보'},
  {value: 'slides', label: '슬라이드'},
] as const;

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
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
}

export function DetailsPanel(props: DetailsPanelProps): JSX.Element {
  const target = props.target;
  const key =
    target === null
      ? 'none'
      : target.kind === 'item'
        ? `item:${target.itemId}`
        : `song:${target.songId}`;
  return <DetailsPanelContent key={key} {...props} />;
}

function DetailsPanelContent({
  target,
  items,
  editor,
  api,
  onOpenPrep,
}: DetailsPanelProps): JSX.Element {
  const serviceId = useShow(view => view.serviceId);
  const itemId = target?.kind === 'item' ? target.itemId : null;
  useEffect(() => {
    items.show(
      itemId !== null && serviceId !== null ? {serviceId, itemId} : null,
    );
    return () => items.show(null);
  }, [items, serviceId, itemId]);
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const service = state.service;
  const raw = useItemSlides(items, editor);
  const [tab, setTab] = useState<'info' | 'slides'>('info');
  const [loadedLibrary, setLibrary] = useState<ShowLibrarySong | null>(null);
  const [selected, setSelected] = useState(0);
  const songId = target?.kind === 'song' ? target.songId : null;
  useEffect(() => {
    let active = true;
    if (songId !== null) {
      api.library
        .showSong({songId})
        .then(value => {
          if (active) setLibrary(value);
        })
        .catch((error: unknown) => console.error(error));
    }
    return () => {
      active = false;
    };
  }, [api, songId]);
  const library = loadedLibrary?.songId === songId ? loadedLibrary : null;
  const item =
    target?.kind === 'item' && state.item?.id === target.itemId
      ? state.item
      : null;
  const card =
    item !== null && hasSectionCard(item) ? item.sectionCard : undefined;
  const offset = card === undefined ? 0 : 1;
  const bible = item !== null && isItemOfKind(item, 'bible');
  const projection = useBibleTileProjection({
    itemId: bible ? item.id : null,
    ...(service === null ? {} : {serviceId: service.service.id}),
  });
  const bibleTiles = projection?.tiles.filter(
    tile => tile.sectionCard === undefined,
  );
  const media = useItemMedia(
    editor.api.media,
    item !== null &&
      (isItemOfKind(item, 'media') || isItemOfKind(item, 'slides')),
  );
  const {title, kind, count} = detailsHeading({
    item: item !== null && isItemOfKind(item, 'header') ? null : item,
    song: state.song,
    library,
    rawCount: bibleTiles?.length ?? raw.length,
    offset,
    mediaTitle:
      item !== null && isItemOfKind(item, 'media')
        ? media.document?.value.items.find(file => file.id === item.media)?.name
        : undefined,
  });
  const theme = useSlideTheme(
    item === null && library === null
      ? undefined
      : {
          id: item?.id ?? library?.songId ?? '',
          kind: 'song',
          title,
          ...(item?.theme === undefined ? {} : {theme: item.theme}),
        },
    library === null ? 'service' : 'external',
  );
  const cardTheme = useSlideTheme(
    card === undefined || item === null
      ? undefined
      : {
          id: item.id,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
  );
  const picture = (index: number): JSX.Element | undefined =>
    detailsPicture(
      {
        item,
        library,
        song: state.song,
        raw,
        card,
        offset,
        theme,
        cardTheme,
        projection,
        bibleTiles,
        editor,
      },
      index,
    );
  const labelAt = (index: number): string | undefined => {
    if (index === 0 && card !== undefined) return card.name;
    if (item !== null && isItemOfKind(item, 'slides')) {
      const slide = item.slides.slides[index - offset];
      return slide === undefined
        ? undefined
        : slideBand(slide, media.document?.value.items ?? []);
    }
    return (
      library?.tiles[index]?.label ??
      bibleTiles?.[index - offset]?.label ??
      raw[index - offset]?.label
    );
  };
  const labelColorAt = (index: number) =>
    index === 0 && card !== undefined
      ? 'none'
      : (library?.tiles[index]?.labelColor ??
        bibleTiles?.[index - offset]?.labelColor ??
        raw[index - offset]?.color ??
        'none');
  const select = (index: number): void => {
    if (item !== null) items.selectPosition(index);
    else setSelected(index);
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
          api.window.openSongEditor({
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
      (isItemOfKind(item, 'bible') || isItemOfKind(item, 'media'))
    ) {
      items.selectPosition(index);
      onOpenPrep?.(item.id);
    } else if (library !== null) {
      openEditor(
        () =>
          api.window.openSongEditor({
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
    openEditor(() => api.window.openSongEditor({songId: item.song}), fail);
  };
  if (item !== null && isItemOfKind(item, 'header')) {
    const itemCount = sectionItemCount(service?.service.order ?? [], item.id);
    return (
      <Panel label="세부정보">
        <PanelBody>
          <div className={styles.title} title={item.header}>
            {item.header}
          </div>
          <div className={styles.meta}>구역, 항목 {itemCount}개</div>
        </PanelBody>
      </Panel>
    );
  }
  return (
    <Panel label="세부정보">
      <PanelBody>
        <div className={styles.picture}>{picture(0)}</div>
        {count === 0 ? null : (
          <SlideThumbnailBand
            number={1}
            label={labelAt(0)}
            labelColor={labelColorAt(0)}
          />
        )}
        <div className={styles.title} title={title}>
          {title}
        </div>
        <div className={styles.meta}>
          {title === '' ? '' : `${kind}, 슬라이드 ${count}개`}
        </div>
        <PanelTabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'info' ? (
          <DetailsInfo
            details={{
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
            }}
          />
        ) : (
          <DetailsSlides
            count={count}
            selected={Math.min(
              Math.max(0, count - 1),
              item === null ? selected : state.position,
            )}
            onSelect={select}
            onEdit={edit}
            labelAt={labelAt}
            colorAt={labelColorAt}
            picture={picture}
          />
        )}
      </PanelBody>
    </Panel>
  );
}
