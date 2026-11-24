import {useEffect, useMemo, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItemId, SongId} from '@core/schema/ids';
import {hasSlides, isItemOfKind} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {itemTiles} from '@core/slides';
import {useLabelColors} from '@renderer/features/labels/labels';
import type {Report} from '@renderer/session/serviceEdit';
import {detailsScale} from '@renderer/platform/thumbnailScale';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useOpenService, useServiceItem} from '@renderer/session/openService';
import {outputSlideOf} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {GridFooter} from '@renderer/ui/GridFooter';
import {warningNotice} from '@renderer/ui/notices';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {Spinner} from '@renderer/ui/Spinner';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {sectionItemCount} from './sectionItemCount';
import {DetailsInfo} from './DetailsInfo';
import {DetailsSlides} from './DetailsSlides';
import {
  PreviewPicture,
  SlidePreview,
  usePreviewScreen,
} from '../../slides/SlidePreview';
import {SlideSidePanel} from '../../slides/SlideSidePanel';
import styles from './DetailsPanel.module.css';

export type DetailsTarget =
  | {readonly kind: 'item'; readonly itemId: ServiceItemId}
  | {readonly kind: 'song'; readonly songId: SongId};

const LABEL = '세부정보';

/** The song of the library that is selected. */
function useLibrarySong(
  api: LlpApi,
  songId: SongId | null,
  report: Report,
): ShowLibrarySong | null {
  const [song, setSong] = useState<ShowLibrarySong | null>(null);
  useEffect(() => {
    if (songId === null) return undefined;
    let active = true;
    api.library.showSong({songId}).then(
      value => {
        if (active) setSong(value);
      },
      () => {
        if (!active) return;
        report(warningNotice('details:library', '곡 불러오기 실패'));
      },
    );
    return () => {
      active = false;
    };
  }, [api, songId, report]);
  return song?.songId === songId ? song : null;
}

/** Details of the selected source; selecting a slide never changes output. */
export function DetailsPanel({
  target,
  api,
  sizeClass,
  onOpenItem,
  onOpenSong,
  report,
}: {
  readonly target: DetailsTarget | null;
  readonly api: LlpApi;
  readonly sizeClass: SizeClass;
  /** Opens an item in the editor, at a slide. */
  readonly onOpenItem: (itemId: string, position: number) => void;
  readonly onOpenSong: (songId: SongId, position: number) => void;
  readonly report: Report;
}): JSX.Element {
  const scale = detailsScale.use(sizeClass);
  const colors = useLabelColors();
  const screen = usePreviewScreen();
  const order = useOpenService(view => view.service?.order);
  const readOnly = useOpenService(view => view.readOnly);
  const item = useServiceItem(target?.kind === 'item' ? target.itemId : null);
  const songId = target?.kind === 'song' ? target.songId : null;
  const library = useLibrarySong(api, songId, report);
  const key =
    target === null
      ? 'none'
      : target.kind === 'item'
        ? `item:${target.itemId}`
        : `song:${target.songId}`;
  const [selection, setSelection] = useState({key, index: 0});
  const slidesItem = item !== undefined && hasSlides(item) ? item : undefined;
  const tiles = useMemo(
    () =>
      slidesItem === undefined
        ? (library?.tiles ?? [])
        : itemTiles(slidesItem, colors),
    [slidesItem, library, colors],
  );
  if (item !== undefined && isItemOfKind(item, 'header')) {
    return (
      <SlideSidePanel label={LABEL}>
        <div className={styles.title} title={item.name}>
          {item.name}
        </div>
        <div className={styles.meta}>
          구역, 항목 {sectionItemCount(order ?? [], item.id)}개
        </div>
      </SlideSidePanel>
    );
  }
  if (slidesItem === undefined && library === null) {
    return (
      <SlideSidePanel label={LABEL}>
        {songId !== null ? <Spinner size="sm" /> : null}
      </SlideSidePanel>
    );
  }
  const count = tiles.length;
  const selected = Math.min(
    Math.max(0, count - 1),
    selection.key === key ? selection.index : 0,
  );
  const nextAtEnd =
    slidesItem === undefined
      ? null
      : (outputSlideOf({itemId: slidesItem.id, index: count - 1})?.next ??
        null);
  const preview = {tiles, screen, nextAtEnd};
  const edit = (index: number): void => {
    if (slidesItem !== undefined) onOpenItem(slidesItem.id, index);
    else if (library !== null) onOpenSong(library.songId, index);
  };
  return (
    <SlideSidePanel
      label={LABEL}
      screen={screen}
      footer={
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
      }
    >
      <SlidePreview {...preview} index={selected} />
      <DetailsInfo
        item={slidesItem}
        songId={library?.songId ?? null}
        reason={readOnly ? NEWER_FILE_REASON : undefined}
        onOpenSong={id => onOpenSong(id, 0)}
        report={report}
      />
      <div className={styles.slidesHead}>
        <p className={styles.slidesTitle}>슬라이드</p>
        <Button icon="edit" onClick={() => edit(selected)}>
          편집
        </Button>
      </div>
      <DetailsSlides
        count={count}
        ids={tiles.map(entry => entry.slide.id)}
        scope={key}
        scale={scale}
        selected={selected}
        onSelect={index => setSelection({key, index})}
        onEdit={edit}
        labelAt={index => tiles[index]?.caption ?? undefined}
        colorAt={index => tiles[index]?.labelColor ?? 'none'}
        picture={index => <PreviewPicture {...preview} index={index} />}
      />
    </SlideSidePanel>
  );
}
