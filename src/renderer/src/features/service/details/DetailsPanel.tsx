import {useEffect, useMemo, useState, type JSX, type ReactNode} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItemId, SongId} from '@core/schema/ids';
import {hasSlides, isItemOfKind} from '@core/schema/service';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {nextTextOfTile} from '@core/presentation/slideLayer';
import {itemTiles} from '@core/slides/tiles';
import {useLabelColors} from '@renderer/features/labels/labels';
import type {Report} from '@renderer/session/serviceEdit';
import {detailsScale} from '@renderer/platform/thumbnailScale';
import {themeOfTile, useThemes} from '@renderer/platform/themes';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {useOpenService, useServiceItem} from '@renderer/session/openService';
import {outputSlideOf} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {GridFooter} from '@renderer/ui/GridFooter';
import {noticeTime} from '@renderer/ui/notices';
import {Panel, PanelBody, PanelTabs} from '@renderer/ui/Panel';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {Spinner} from '@renderer/ui/Spinner';
import {ThumbnailSizeControl} from '@renderer/ui/ThumbnailSizeControl';
import {detailsHeading, sectionItemCount} from './detailsHeading';
import {DetailsInfo} from './DetailsInfo';
import {DetailsSlides} from './DetailsSlides';
import {SlidePreview, usePreviewScreen} from './SlidePreview';
import styles from './DetailsPanel.module.css';

export type DetailsTarget =
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
        report({
          key: 'details:library',
          kind: 'warning',
          icon: 'warning',
          title: '곡 불러오기 실패',
          time: noticeTime(),
        });
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
  const screens = useThemes(view => view.screens);
  const previewScreen = usePreviewScreen(screens);
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
  const [tabState, setTab] = useState<{
    readonly key: string;
    readonly value: 'info' | 'slides';
  }>({key, value: 'info'});
  const tab = tabState.key === key ? tabState.value : 'info';
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
      <DetailsShell>
        <div className={styles.title} title={item.name}>
          {item.name}
        </div>
        <div className={styles.meta}>
          구역, 항목 {sectionItemCount(order ?? [], item.id)}개
        </div>
      </DetailsShell>
    );
  }
  if (slidesItem === undefined && library === null) {
    return (
      <DetailsShell>
        {songId !== null ? <Spinner size="sm" /> : null}
      </DetailsShell>
    );
  }
  const count = tiles.length;
  const selected = Math.min(
    Math.max(0, count - 1),
    selection.key === key ? selection.index : 0,
  );
  const role = previewScreen.target?.kind ?? 'audience';
  const nextOf = (index: number): string | null => {
    const after = tiles[index + 1];
    if (after !== undefined) return nextTextOfTile(after, themeOfTile, false);
    return slidesItem === undefined
      ? null
      : (outputSlideOf({itemId: slidesItem.id, index})?.next ?? null);
  };
  const picture = (index: number): JSX.Element | undefined => {
    const tile = tiles[index];
    return tile === undefined ? undefined : (
      <TilePicture
        tile={tile}
        tiles={tiles}
        role={role}
        screenId={previewScreen.target?.id}
        next={role === 'audience' ? null : nextOf(index)}
      />
    );
  };
  const edit = (index: number): void => {
    if (slidesItem !== undefined) onOpenItem(slidesItem.id, index);
    else if (library !== null) onOpenSong(library.songId, index);
  };
  const {title, line} = detailsHeading(slidesItem, library, count);
  const tile = tiles[selected];
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
        picture={picture(selected)}
        screen={previewScreen}
        number={count === 0 ? undefined : selected + 1}
        label={tile?.caption ?? undefined}
        color={tile?.labelColor ?? 'none'}
      />
      <div className={styles.title} title={title}>
        {title}
      </div>
      <div className={styles.meta}>{line}</div>
      <Button icon="edit" onClick={() => edit(selected)}>
        편집
      </Button>
      <PanelTabs
        tabs={tabs}
        value={tab}
        onChange={value => setTab({key, value})}
      />
      {tab === 'info' ? (
        <DetailsInfo
          item={slidesItem}
          songId={library?.songId ?? null}
          api={api}
          reason={readOnly ? NEWER_FILE_REASON : undefined}
          onOpenSong={id => onOpenSong(id, 0)}
          report={report}
        />
      ) : (
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
          picture={picture}
        />
      )}
    </DetailsShell>
  );
}
