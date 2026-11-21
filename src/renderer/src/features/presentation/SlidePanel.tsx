import {useEffect, useState, useSyncExternalStore, type JSX} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {defaultThumbnailColumns, type SizeClass} from '@renderer/ui/sizeClass';
import {useShow} from '@renderer/session/show';
import {
  isLibrarySource,
  projectedLiveCursor,
  tilesForView,
  useLiveTileIndex,
} from '@renderer/session/showLibrary';
import {useThumbnailScale} from '@renderer/platform/thumbnailScale';
import {SlideSizeControl} from '@renderer/platform/SlideSizeControl';
import {Button, Icon} from '@renderer/ui';
import {missingBackgroundTip} from '@renderer/features/media/backgroundChoices';
import {openSongEditorWindow} from '@renderer/features/songs/editor/openWindow';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {Notice} from '@renderer/ui/notices';
import {GridFooter} from '@renderer/ui/GridFooter';
import {useTooltip} from '@renderer/ui/Tooltip';
import {SlideGrid} from './SlideGrid';
import {ContinuousSlideGrid} from './ContinuousSlideGrid';
import {liveReturn} from './liveReturn';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {READ_ONLY_TIP} from '../../platform/problemReasons';
import styles from './SlidePanel.module.css';
import {useVisibleSlideItem} from '@renderer/session/visibleSlideItem';
import {
  hasRetainedGrid,
  retainedGridsVersion,
  ShownItemProvider,
  subscribeRetainedGrids,
  useShownItemId,
} from '@renderer/session/shownItem';
import {useLive} from '@renderer/session/live';
import {isItemRow} from '@core/presentation/model';

const PROBLEM_ICON_SIZE = 14;
const NO_PREBUILT: readonly string[] = [];

/** The 슬라이드 grid at the size chosen for the current size class. */
export function SlidePanelBody({
  sizeClass,
  onOpenPrep,
  active = true,
  prebuildService = false,
}: {
  readonly sizeClass: SizeClass;
  readonly active?: boolean;
  readonly prebuildService?: boolean;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
}): JSX.Element {
  const settings = useSettingsDocument('preferences', '환경설정', undefined);
  const scalePercent = useThumbnailScale(sizeClass);
  const shownItemId = useShownItemId();
  const serviceRows = useShow(
    useShallow(view => view.rows.filter(isItemRow).map(row => row.id)),
  );
  const serviceId = useShow(view => view.serviceId);
  const keptVersion = useSyncExternalStore(
    subscribeRetainedGrids,
    retainedGridsVersion,
  );
  const [preparing, setPreparing] = useState<{
    serviceId: string | null;
    items: readonly string[];
  }>({serviceId: null, items: []});
  const prebuilt =
    preparing.serviceId === serviceId ? preparing.items : NO_PREBUILT;
  useEffect(() => {
    if (!prebuildService || serviceId === null) return;
    const present = prebuilt.filter(id => serviceRows.includes(id));
    const pending = present.some(id => !hasRetainedGrid(serviceId, id));
    const next = serviceRows.find(id => !present.includes(id));
    if (pending || next === undefined) return;
    const timer = setTimeout(
      () => setPreparing({serviceId, items: [...present, next]}),
      0,
    );
    return () => clearTimeout(timer);
  }, [prebuildService, prebuilt, serviceId, serviceRows, keptVersion]);
  const isServiceItem = useShow(
    view =>
      shownItemId === null || view.rows.some(row => row.id === shownItemId),
  );
  const continuous =
    settings?.value.show?.continuousGrid === true && isServiceItem;
  const [visitedContinuous, setVisitedContinuous] = useState(false);
  if (continuous && !visitedContinuous) setVisitedContinuous(true);
  const [visited, setVisited] = useState<ReadonlyArray<string | null>>([]);
  if (!continuous && !visited.includes(shownItemId)) {
    setVisited([...visited, shownItemId]);
  }
  return (
    <>
      {visitedContinuous ? (
        <div
          data-slide-grid-cache
          aria-hidden={!active || !continuous}
          inert={!active || !continuous}
          style={{display: active && continuous ? 'contents' : 'none'}}
        >
          <ContinuousSlideGrid
            active={active && continuous}
            columns={defaultThumbnailColumns[sizeClass]}
            scalePercent={scalePercent}
            onOpenPrep={onOpenPrep}
          />
        </div>
      ) : null}
      {[...new Set([...visited, ...(prebuildService ? prebuilt : [])])].map(
        itemId => {
          const gridActive = active && !continuous && itemId === shownItemId;
          return (
            <div
              key={itemId ?? ''}
              data-slide-grid-cache
              data-grid-item={itemId ?? undefined}
              aria-hidden={!gridActive}
              inert={!gridActive}
              style={{display: gridActive ? 'contents' : 'none'}}
            >
              <ShownItemProvider shownItem={itemId} trackLive={false}>
                <SlideGrid
                  active={gridActive}
                  prebuild={
                    prebuildService &&
                    itemId !== null &&
                    serviceRows.includes(itemId)
                  }
                  columns={defaultThumbnailColumns[sizeClass]}
                  scalePercent={scalePercent}
                  onOpenPrep={onOpenPrep}
                />
              </ShownItemProvider>
            </div>
          );
        },
      )}
    </>
  );
}

/**
 * The item name and, for the live item, its current slide position.
 */
export function SlidePanelMeta({
  onProblem = console.error,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const visibleItemId = useVisibleSlideItem();
  const continuous = useSyncExternalStore(liveReturn.subscribe, liveReturn.get);
  const slide = useLive(view => view.state?.layers.slide ?? null);
  const liveCursor = useShow(
    useShallow(view => {
      if (continuous === 'none') return null;
      const cursor = projectedLiveCursor(view, slide);
      return cursor !== null && view.rows.some(row => row.id === cursor.itemId)
        ? cursor
        : null;
    }),
  );
  const openItemId = liveCursor?.itemId ?? visibleItemId;
  const source = useShow(view =>
    isLibrarySource(view, openItemId) ? view.librarySong : null,
  );
  const reason =
    source?.problem === 'missing-background'
      ? missingBackgroundTip(source.missingBackgroundName)
      : source?.readOnly
        ? READ_ONLY_TIP
        : undefined;
  const {targetProps, tooltip} = useTooltip(
    reason ? {text: reason} : undefined,
  );
  const title = useShow(view =>
    isLibrarySource(view, openItemId)
      ? view.librarySong.title
      : view.rows.find(row => row.id === openItemId)?.title,
  );
  const count = useShow(view =>
    openItemId === null ? 0 : tilesForView(view, openItemId).length,
  );
  const selectedLivePosition = useLiveTileIndex();
  const livePosition =
    continuous === 'none' ? selectedLivePosition : (liveCursor?.index ?? null);
  if (title === undefined) return null;
  const position =
    livePosition === null ? undefined : `${livePosition + 1} / ${count}`;
  return (
    <span className={styles.meta}>
      <span className={styles.name}>{title}</span>
      {reason ? (
        <>
          <span
            {...targetProps}
            role="img"
            aria-label={reason}
            className={styles.warning}
          >
            <Icon name="warning" size={PROBLEM_ICON_SIZE} />
          </span>
          {tooltip}
          {source?.problem === 'missing-background' ? (
            <Button
              size="sm"
              disabled={source.readOnly || window.llp === undefined}
              onClick={() => {
                const api = window.llp;
                if (api === undefined) return;
                editorTask(
                  openSongEditorWindow({songId: source.songId}, onProblem),
                );
              }}
            >
              배경 바꾸기
            </Button>
          ) : null}
        </>
      ) : null}
      {position === undefined ? null : (
        <span className={styles.position}>{position}</span>
      )}
    </span>
  );
}

export function SlidePanelFooter({
  sizeClass,
}: {
  readonly sizeClass: SizeClass;
}): JSX.Element {
  const live = useSyncExternalStore(liveReturn.subscribe, liveReturn.get);
  return (
    <GridFooter
      actions={
        live === 'none' ? null : (
          <Button
            size="sm"
            disabled={live !== 'away'}
            onClick={() => liveReturn.go()}
          >
            현 위치로
          </Button>
        )
      }
      zoom={<SlideSizeControl sizeClass={sizeClass} />}
    />
  );
}
