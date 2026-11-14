import {parseMediaId} from '@core/schema/ids';
import {useShow} from '@renderer/session/show';
import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {MediaItem} from '@core/schema/mediaList';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import type {Slide, SlidesItem} from '@core/services/slidesEdits';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {cardOffset, withSectionCard} from '@core/services/sectionCards';
import {projectSlides} from '@core/presentation/slides';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {useSlidesVerseProjection} from '@renderer/features/bible/useSlidesVerseProjection';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {Button} from '@renderer/ui/Button';
import {Picture} from '@renderer/features/songs/editor/SongPreview';
import {
  previewAppearance,
  type PreviewRole,
} from '@renderer/features/songs/editor/songPreviewModel';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import {useItemSettings} from '../items/useItemSources';
import styles from './SlidesEditor.module.css';

export function slideBand(slide: Slide, media: readonly MediaItem[]): string {
  if ('verse' in slide) {
    const book = BIBLE_BOOKS.find(book => book.id === slide.verse.book);
    return `${book?.korean ?? '성경'} ${slide.verse.chapter}:${slide.verse.verse}`;
  }
  if ('media' in slide) {
    const file = media.find(file => file.id === slide.media);
    if (file?.internal === true) return '';
    return file?.file.split(/[\\/]/).at(-1) ?? file?.name ?? '미디어 없음';
  }
  return slide.name ?? slide.text.split('\n')[0] ?? '';
}

/** Combines the current projected background with the editor's unsaved slide draft. */
export function useSlidesItemWithBackground(draftItem: SlidesItem): SlidesItem {
  const row = useShow(view =>
    view.rows.find(entry => entry.id === draftItem.id),
  );
  if (row?.kind !== 'slides') return draftItem;
  const parsed = parseMediaId(row.background?.mediaId);
  const {background: _background, ...item} = draftItem;
  return parsed.ok ? {...item, background: parsed.value} : item;
}

export function useSlidesAppearance(
  api: Pick<LlpApi, 'settings'>,
  item: SlidesItem,
  role: PreviewRole = 'audience',
) {
  const themes = useItemSettings(api.settings, 'themes');
  const screens = useItemSettings(api.settings, 'screens');
  const themeFile =
    themes.document?.name === 'themes' ? themes.document.value : undefined;
  const screenFile =
    screens.document?.name === 'screens' ? screens.document.value : undefined;
  const appearance = useMemo(
    () =>
      previewAppearance({
        role,
        themes: themeFile,
        screens: screenFile,
        item: {
          ...item,
          kind: item.slides.form,
          source: 'service',
          title: item.slides.name,
        },
      }),
    [role, themeFile, screenFile, item],
  );
  return {appearance, themes: themeFile};
}

export function slideLayers(
  item: SlidesItem,
  index: number,
  {
    projection,
    part = 0,
  }: {
    readonly projection?: BibleProjection | null | undefined;
    readonly part?: number | undefined;
  } = {},
): LiveLayers {
  if (projection != null) {
    const id = item.slides.slides[index]?.id;
    const indices = projection.tiles.flatMap((tile, at) =>
      tile.sourceSlideId === id ? [at] : [],
    );
    const at = indices[Math.min(part, indices.length - 1)];
    if (at === undefined) return emptyLayers();
    const tile = projection.tiles[at];
    const background = tile?.picture ?? item.background;
    return {
      ...emptyLayers(),
      slide: slideLayerOf({itemId: item.id, index: at}, () => projection.tiles),
      media:
        background === undefined
          ? null
          : {
              mediaId: background,
              loop: tile?.picture === undefined,
              startedAt: 0,
              ...(tile?.picture === undefined
                ? {}
                : {itemId: item.id, slidePicture: true}),
            },
    };
  }
  const tiles = withSectionCard(item.sectionCard, projectSlides(item));
  const slide = slideLayerOf(
    {itemId: item.id, index: index + cardOffset(item)},
    () => tiles,
  );
  if (slide === null) return emptyLayers();
  const background = slide.picture ?? item.background;
  return {
    ...emptyLayers(),
    slide,
    media:
      background === undefined
        ? null
        : {
            mediaId: background,
            loop: slide.picture === undefined,
            startedAt: 0,
            ...(slide.picture === undefined
              ? {}
              : {itemId: item.id, slidePicture: true}),
          },
  };
}

export function SlidesCanvas({
  item,
  index,
  appearance,
  projection,
  part,
  thumbnail = false,
}: {
  readonly item: SlidesItem;
  readonly index: number;
  readonly appearance: ReturnType<typeof previewAppearance>;
  readonly projection?: BibleProjection | null;
  readonly part?: number;
  readonly thumbnail?: boolean;
}): JSX.Element {
  const layers = useMemo(
    () => slideLayers(item, index, {projection, part}),
    [item, index, projection, part],
  );
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    if (host.current === null || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        setVisible(entries.some(entry => entry.isIntersecting));
      },
      {rootMargin: '200px'},
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={host} className={styles.canvas}>
      {visible && thumbnail && layers.slide?.biblePart !== undefined ? (
        <SlidePicture
          exact
          screen={appearance.screen}
          themeId={appearance.theme.themeId}
          slide={layers.slide}
          layout={appearance.theme.layout}
          emptyColor={appearance.theme.emptyColor}
          item={appearance.theme.item}
          background={layers.media?.mediaId}
        />
      ) : visible ? (
        <Picture layers={layers} appearance={appearance} />
      ) : null}
    </div>
  );
}

export function SlidesPreview({
  api,
  item,
  selected,
  media,
  projection,
  offset = 0,
}: {
  readonly api: Pick<LlpApi, 'settings' | 'bible'>;
  readonly item: SlidesItem;
  readonly selected: number;
  readonly offset?: number;
  readonly media: readonly MediaItem[];
  readonly projection?: BibleProjection | null;
}): JSX.Element {
  const [role, setRole] = useState<PreviewRole>('audience');
  const appearances = {
    audience: useSlidesAppearance(api, item, 'audience').appearance,
    stage: useSlidesAppearance(api, item, 'stage').appearance,
    broadcast: useSlidesAppearance(api, item, 'broadcast').appearance,
  };
  const appearance = appearances[role];
  const slide = item.slides.slides[selected];
  const {projection: localProjection} = useSlidesVerseProjection(
    api,
    item,
    projection === undefined,
  );
  const shown = projection === undefined ? localProjection : projection;
  const shownProjection = shown;
  const count =
    shown?.tiles.filter(tile => tile.sourceSlideId === slide?.id).length ?? 1;
  const [chosenPart, setChosenPart] = useState({id: slide?.id, index: 0});
  const part =
    chosenPart.id === slide?.id
      ? Math.min(chosenPart.index, Math.max(0, count - 1))
      : 0;
  return (
    <RolePreview
      big={role}
      onBigChange={setRole}
      renderRole={forRole => (
        <SlidesCanvas
          item={item}
          index={selected}
          appearance={appearances[forRole]}
          projection={shownProjection}
          part={part}
        />
      )}
      caption={() =>
        slide === undefined ? (
          <span className={styles.themeName}>{appearance.themeName}</span>
        ) : (
          <>
            <span>
              {'text' in slide ? slide.name : slideBand(slide, media)}
            </span>
            <span>
              {selected + 1 + offset} / {item.slides.slides.length + offset}
            </span>
            <span className={styles.themeName}>{appearance.themeName}</span>
          </>
        )
      }
    >
      {slide === undefined || count <= 1 ? null : (
        <div className={styles.caption} data-preview-extra="">
          <Button
            disabled={part === 0}
            onClick={() => setChosenPart({id: slide.id, index: part - 1})}
          >
            이전 부분
          </Button>
          <span>
            {part + 1} / {count}
          </span>
          <Button
            disabled={part + 1 >= count}
            onClick={() => setChosenPart({id: slide.id, index: part + 1})}
          >
            다음 부분
          </Button>
        </div>
      )}
    </RolePreview>
  );
}
