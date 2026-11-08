import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {MediaItem} from '@core/schema/mediaList';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {emptyLayers, type LiveLayers} from '@core/live/state';
import type {Slide, SlidesItem} from '@core/services/slidesEdits';
import {slideLayerOf} from '@core/presentation/slideLayer';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {useSlidesVerseProjection} from '@renderer/features/bible/useSlidesVerseProjection';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {Button} from '@renderer/ui/Button';
import {Picture} from '@renderer/features/songs/editor/SongPreview';
import {
  previewAppearance,
  PREVIEW_ROLES,
  type PreviewRole,
} from '@renderer/features/songs/editor/songPreviewModel';
import {Panel, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import {PreviewScreenPicker} from '@renderer/ui/PreviewScreenPicker';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import {useItemSettings} from '../items/useItemSources';
import styles from './SlidesEditor.module.css';
import {
  defaultPreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import type {SlideTransition} from '@core/schema/slideTransition';

export function slideBand(slide: Slide, media: readonly MediaItem[]): string {
  if ('verse' in slide) {
    const book = BIBLE_BOOKS.find(book => book.id === slide.verse.book);
    return `${book?.korean ?? '성경'} ${slide.verse.chapter}:${slide.verse.verse}`;
  }
  if ('media' in slide) {
    const file = media.find(file => file.id === slide.media);
    return file?.file.split(/[\\/]/).at(-1) ?? file?.name ?? '미디어 없음';
  }
  return slide.name ?? slide.text.split('\n')[0] ?? '';
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
  const slide = item.slides.slides[index];
  if (slide === undefined) return emptyLayers();
  const next = item.slides.slides[index + 1];
  const background = 'media' in slide ? slide.media : item.background;
  return {
    ...emptyLayers(),
    slide: {
      itemId: item.id,
      position: index,
      ...(slide.transition === undefined ? {} : {transition: slide.transition}),
      ...(item.slides.form === 'ad' && 'text' in slide
        ? {
            textSlideNumber: item.slides.slides
              .slice(0, index + 1)
              .filter(slide => 'text' in slide).length,
          }
        : {}),
      label: null,
      lines: 'text' in slide ? slide.text.split('\n') : [],
      ...('text' in slide && slide.name !== undefined
        ? {name: slide.name}
        : {}),
      ...(next === undefined
        ? {}
        : {
            next: {
              label: null,
              lines: 'text' in next ? next.text.split('\n') : [],
            },
          }),
    },
    media:
      background === undefined
        ? null
        : {
            mediaId: background,
            loop: true,
            startedAt: 0,
            ...('media' in slide ? {itemId: item.id, slidePicture: true} : {}),
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
  transition,
}: {
  readonly item: SlidesItem;
  readonly index: number;
  readonly appearance: ReturnType<typeof previewAppearance>;
  readonly projection?: BibleProjection | null;
  readonly part?: number;
  readonly thumbnail?: boolean;
  readonly transition?: SlideTransition | undefined;
}): JSX.Element {
  const layers = useMemo(
    () => slideLayers(item, index, {projection, part}),
    [item, index, projection, part],
  );
  const host = useRef<HTMLDivElement>(null);
  const before = useMemo(
    () =>
      index === 0
        ? {...layers, slide: null}
        : slideLayers(item, index - 1, {projection}),
    [item, index, projection, layers],
  );
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
          slide={layers.slide}
          layout={appearance.theme.layout}
          emptyColor={appearance.theme.emptyColor}
          item={appearance.theme.item}
          background={layers.media?.mediaId}
        />
      ) : visible ? (
        <Picture
          layers={layers}
          appearance={appearance}
          animate={!thumbnail}
          transition={thumbnail ? undefined : transition}
          before={before}
        />
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
}: {
  readonly api: Pick<LlpApi, 'settings' | 'bible'>;
  readonly item: SlidesItem;
  readonly selected: number;
  readonly media: readonly MediaItem[];
  readonly projection?: BibleProjection | null;
}): JSX.Element {
  const [role, setRole] = useState<PreviewRole>('audience');
  const [room, setRoom] = useState(true);
  const preferences = useItemSettings(api.settings, 'preferences');
  const defaults =
    preferences.document?.name === 'preferences'
      ? withPreferenceDefaults(preferences.document.value)
      : defaultPreferences;
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
    <Panel label="미리보기">
      <PanelHeader>
        <PanelTitle title="미리보기" />
        {room ? null : (
          <PreviewScreenPicker
            screens={PREVIEW_ROLES.map(entry => ({
              id: entry.value,
              name: entry.label,
            }))}
            big={role}
            onChange={setRole}
          />
        )}
      </PanelHeader>
      <RolePreview
        big={role}
        onBigChange={setRole}
        onRoom={setRoom}
        renderRole={forRole => (
          <SlidesCanvas
            item={item}
            index={selected}
            appearance={appearances[forRole]}
            projection={shownProjection}
            part={part}
            transition={
              slide?.transition ??
              defaults.output.transition[selected === 0 ? 'between' : 'within']
            }
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
                {selected + 1} / {item.slides.slides.length}
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
    </Panel>
  );
}
