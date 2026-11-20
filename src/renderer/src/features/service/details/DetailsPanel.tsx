import {withPreferenceDefaults} from '@core/schema/preferences';
import {requestSongEditor} from '@renderer/features/songs/editor/songEditorRequests';
import {
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {hasSectionCard} from '@core/services/sectionCards';
import type {ServiceItemId, SongId} from '@core/schema/ids';
import type {LlpApi} from '@contracts/ipc/api';
import {noticeTime} from '@renderer/ui/notices';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {useShow} from '@renderer/session/show';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {sermonPreviewRow} from '@renderer/platform/sermonPreview';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import {BibleLoadNotice} from '@renderer/features/bible/BibleLoadNotice';
import {Panel, PanelBody, PanelFooter, PanelTabs} from '@renderer/ui/Panel';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {useItemSlides} from '../items/useItemSlides';
import {useItemMedia} from '../items/useItemSources';
import {useItemSettings} from '../items/useItemSources';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {slideBand} from '../slides/SlidesVisuals';
import {
  detailsHeading,
  detailsKindLine,
  sectionItemCount,
} from './detailsHeading';
import {detailsPicture} from './detailsPicture';
import {DetailsInfo} from './DetailsInfo';
import {useItemTheme} from './ItemThemeRow';
import {DetailsSlides} from './DetailsSlides';
import {SlidePreview, usePreviewScreen} from './SlidePreview';
import {AheadBox, DrawAhead} from '@renderer/rendering/DrawAhead';

/** The 슬라이드 tab tiles drawn ahead while 정보 shows: about a screen of them. */
const DETAILS_AHEAD = 12;
/** Drawing ahead starts this long after the panel shows an item. */
const DETAILS_AHEAD_AFTER_MS = 400;
import {detailsScale} from '@renderer/platform/thumbnailScale';
import styles from './DetailsPanel.module.css';
import {AtomicPictureContent} from '@renderer/rendering/AtomicPictureContent';
import {PictureReadiness} from '@renderer/rendering/PictureReadiness';

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

function SelectedPreview({
  identity,
  pending,
  waitForPicture,
  content,
}: {
  readonly identity: string;
  readonly pending: boolean;
  readonly waitForPicture: boolean;
  readonly content: JSX.Element;
}): JSX.Element {
  const parent = useContext(PictureReadiness);
  if (parent !== null) return content;
  return (
    <AtomicPictureContent
      identity={identity}
      pending={pending}
      waitForPicture={waitForPicture}
      initial={content}
      initialReady
      content={content}
    />
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
  const raw = useItemSlides(items, editor, media);
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
  const [aheadDone, setAheadDone] = useState<string | null>(null);
  const [aheadDue, setAheadDue] = useState<string | null>(null);
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
  const card =
    item !== null && hasSectionCard(item) ? item.sectionCard : undefined;
  const offset = card === undefined ? 0 : 1;
  const bible =
    item !== null &&
    (isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon'));
  const themeSettings = useItemSettings(api.settings, 'themes', bible);
  const screenSettings = useItemSettings(api.settings, 'screens');
  const screens =
    screenSettings.document?.name === 'screens'
      ? screenSettings.document.value.screens
      : [];
  const previewScreen = usePreviewScreen(screens);
  const targetScreen = previewScreen.target;
  const role = targetScreen?.kind ?? 'audience';
  const previewPreferences = useItemSettings(
    api.settings,
    'preferences',
    bible && role === 'stage',
  );
  const screenId = targetScreen?.id;
  const aheadIdentity = `${detailsKey}:${screenId ?? ''}`;
  useEffect(() => {
    const timer = setTimeout(
      () => setAheadDue(aheadIdentity),
      DETAILS_AHEAD_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [aheadIdentity]);
  const projection = useBibleTileProjection({
    itemId: bible ? item.id : null,
    ...(service === null ? {} : {serviceId: service.service.id}),
  });
  const bibleTiles = projection?.tiles.filter(
    tile => tile.sectionCard === undefined,
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
  const reflowCounts = new Map<string, number>();
  const detailsIds = Array.from({length: count}, (_, index) => {
    const position = index - offset;
    const identity =
      index === 0 && card !== undefined
        ? 'section-card'
        : item !== null && isItemOfKind(item, 'slides')
          ? item.slides.slides[position]?.id
          : raw[position]?.id;
    const base =
      identity ??
      JSON.stringify(
        library?.tiles[index] ??
          bibleTiles?.[position] ??
          raw[position] ??
          index,
      );
    const ordinal = reflowCounts.get(base) ?? 0;
    reflowCounts.set(base, ordinal + 1);
    return `${base}:${ordinal}`;
  });
  const itemTheme =
    item?.theme ??
    (item !== null && isItemOfKind(item, 'song')
      ? state.song?.history.snapshot.song.theme
      : undefined);
  const bibleAppearance =
    bible && projection?.appearance?.theme.item
      ? previewAppearance({
          role,
          screenId,
          stageLyricLabelPosition:
            previewPreferences.document?.name === 'preferences'
              ? withPreferenceDefaults(previewPreferences.document.value).output
                  .stageLyricLabelPosition
              : undefined,
          themes:
            themeSettings.document?.name === 'themes'
              ? themeSettings.document.value
              : undefined,
          screens:
            screenSettings.document?.name === 'screens'
              ? screenSettings.document.value
              : undefined,
          item: {
            ...projection.appearance.theme.item,
            ...(item.theme === undefined ? {} : {theme: item.theme}),
          },
        })
      : undefined;
  const theme = useSlideTheme(
    item === null && library === null
      ? undefined
      : {
          id: item?.id ?? library?.songId ?? '',
          kind: item !== null && isItemOfKind(item, 'media') ? 'media' : 'song',
          title,
          ...(itemTheme === undefined ? {} : {theme: itemTheme}),
        },
    library === null ? 'service' : 'external',
    {
      api,
      role,
      ...(screenId === undefined ? {} : {screenId}),
      ...(itemTheme === undefined ? {} : {theme: itemTheme}),
    },
  );
  const sermonTheme = useSlideTheme(
    item !== null && isItemOfKind(item, 'sermon')
      ? sermonPreviewRow(item.id, item.sermon.passage.ref)
      : undefined,
    'service',
    {api, role, ...(screenId === undefined ? {} : {screenId})},
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
    'service',
    {api, role, ...(screenId === undefined ? {} : {screenId})},
  );
  const picture = (index: number): JSX.Element | undefined =>
    detailsPicture(
      {
        item,
        library,
        song: state.song,
        raw,
        projectedTiles,
        role,
        screenId,
        bibleAppearance,
        card,
        offset,
        theme,
        cardTheme,
        sermonTheme,
        projection,
        bibleTiles,
        editor,
      },
      index,
    );
  const labelAt = (index: number): string | undefined => {
    if (index === 0 && card !== undefined) return card.label ?? card.name;
    if (item !== null && isItemOfKind(item, 'slides')) {
      const slide = item.slides.slides[index - offset];
      return slide === undefined
        ? undefined
        : slideBand(slide, media.document?.value.items ?? []);
    }
    return (
      library?.tiles[index]?.label ??
      bibleTiles?.[index - offset]?.slideLabel ??
      bibleTiles?.[index - offset]?.label ??
      raw[index - offset]?.label
    );
  };
  const labelColorAt = (index: number) =>
    index === 0 && card !== undefined
      ? (projectedTiles?.[0]?.labelColor ?? 'none')
      : (library?.tiles[index]?.labelColor ??
        bibleTiles?.[index - offset]?.labelColor ??
        raw[index - offset]?.color ??
        'none');
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
      <AtomicPictureContent
        initial={<DetailsShell />}
        identity={detailsKey}
        showLoading
        pending={target !== null && !deleted}
        content={<DetailsShell />}
      />
    );
  }
  if (item !== null && isItemOfKind(item, 'header')) {
    const itemCount = sectionItemCount(service?.service.order ?? [], item.id);
    return (
      <AtomicPictureContent
        initial={<DetailsShell />}
        identity={detailsKey}
        pending={false}
        content={
          <DetailsShell>
            <div className={styles.title} title={item.header}>
              {item.header}
            </div>
            <div className={styles.meta}>구역, 항목 {itemCount}개</div>
          </DetailsShell>
        }
      />
    );
  }
  const selectedIndex = Math.min(
    Math.max(0, count - 1),
    item === null ? selected : state.position,
  );
  const firstPicture =
    passageProblem === undefined ? picture(selectedIndex) : undefined;
  const waitForPicture = passageProblem === undefined && count > 0;
  const pending =
    (screenSettings.document === null && !screenSettings.failed) ||
    (waitForPicture && firstPicture === undefined) ||
    (item !== null && !themeData.ready) ||
    (item !== null &&
      isItemOfKind(item, 'song') &&
      state.songStatus === 'loading') ||
    (item !== null &&
      (isItemOfKind(item, 'song') || isItemOfKind(item, 'slides')) &&
      media.document === null &&
      !media.failed);
  const identity = `${detailsKey}:${screenId ?? ''}`;
  // NOTE(0913vision): While 정보 shows, the 슬라이드 tab's first tiles draw out
  // of sight, so switching tabs shows every tile drawn, the first one too,
  // whose picture the large preview above is using.
  const ahead =
    tab === 'info' &&
    !pending &&
    aheadDue === identity &&
    aheadDone !== identity
      ? Array.from({length: Math.min(count, DETAILS_AHEAD)}, (_, index) =>
          picture(index),
        ).filter(each => each !== undefined)
      : null;
  return (
    <AtomicPictureContent
      initial={<DetailsShell />}
      identity={identity}
      showLoading
      aside={
        ahead === null ? null : (
          <AheadBox>
            <DrawAhead
              key={identity}
              pictures={ahead}
              onDone={() => setAheadDone(identity)}
            />
          </AheadBox>
        )
      }
      waitForPicture={waitForPicture}
      pending={pending}
      content={
        <DetailsShell
          footer={
            tab === 'slides' ? (
              <PanelFooter
                count={count}
                end={
                  <ThumbnailSizeControl
                    compact
                    value={scale}
                    onChange={value => detailsScale.show(sizeClass, value)}
                    onCommit={value =>
                      detailsScale.save(sizeClass, value, api.ui)
                    }
                  />
                }
              />
            ) : null
          }
        >
          <SelectedPreview
            identity={`${identity}:${selectedIndex}`}
            pending={pending}
            waitForPicture={waitForPicture}
            content={
              <SlidePreview
                picture={
                  passageProblem === undefined ? (
                    firstPicture
                  ) : (
                    <BibleLoadNotice row={passageProblem} />
                  )
                }
                screen={previewScreen}
                number={count === 0 ? undefined : selectedIndex + 1}
                label={labelAt(selectedIndex)}
                color={labelColorAt(selectedIndex)}
              />
            }
          />
          <div className={styles.title} title={title}>
            {title}
          </div>
          <div className={styles.meta}>
            {title === '' || passageProblem !== undefined
              ? ''
              : detailsKindLine(item, kind, count)}
          </div>
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
            <PictureReadiness.Provider value={null}>
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
            </PictureReadiness.Provider>
          )}
        </DetailsShell>
      }
    />
  );
}
