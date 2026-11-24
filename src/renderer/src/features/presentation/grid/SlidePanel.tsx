import {useSyncExternalStore, type JSX} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {
  defaultThumbnailColumns,
  type SizeClass,
} from '@renderer/ui/panels/sizeClass';
import {
  isLibrarySource,
  projectedLiveCursor,
  tilesForView,
  useLiveTileIndex,
} from '@renderer/session/show/showLibrary';
import {useThumbnailScale} from '@renderer/platform/thumbnailScale';
import {SlideSizeControl} from '@renderer/platform/SlideSizeControl';
import {Button} from '@renderer/ui/buttons/Button';
import {Icon} from '@renderer/ui/Icon';
import {PanelTitle} from '@renderer/ui/panels/Panel';
import {GridFooter} from '@renderer/ui/lists/GridFooter';
import {useTooltip} from '@renderer/ui/popups/Tooltip';
import {SlideGrid} from './SlideGrid';
import {ContinuousSlideGrid} from './ContinuousSlideGrid';
import {liveReturn} from './liveReturn';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {READ_ONLY_TIP} from '../../../platform/problemReasons';
import styles from './SlidePanel.module.css';
import {useVisibleSlideItem} from '@renderer/session/show/visibleSlideItem';
import {useShownItemId} from '@renderer/session/show/shownItem';
import {useLive} from '@renderer/session/live';
import {useShow} from '@renderer/session/show/showStore';

const PROBLEM_ICON_SIZE = 14;

/** The 슬라이드 grid at the size chosen for the current size class. */
export function SlidePanelBody({
  sizeClass,
  onOpenPrep,
}: {
  readonly sizeClass: SizeClass;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
}): JSX.Element {
  const settings = useSettingsDocument('preferences', '환경설정', undefined);
  const scalePercent = useThumbnailScale(sizeClass);
  const shownItemId = useShownItemId();
  const isServiceItem = useShow(
    view =>
      shownItemId === null || view.rows.some(row => row.id === shownItemId),
  );
  const Grid =
    settings?.value.show?.continuousGrid && isServiceItem
      ? ContinuousSlideGrid
      : SlideGrid;
  return (
    <Grid
      columns={defaultThumbnailColumns[sizeClass]}
      scalePercent={scalePercent}
      onOpenPrep={onOpenPrep}
    />
  );
}

/**
 * The item name and, for the live item, its current slide position.
 */
export function SlidePanelMeta(): JSX.Element | null {
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
  const reason = source?.readOnly ? READ_ONLY_TIP : undefined;
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
    <PanelTitle title={title} meta={position}>
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
        </>
      ) : null}
    </PanelTitle>
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
