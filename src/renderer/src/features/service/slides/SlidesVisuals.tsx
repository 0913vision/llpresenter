import {parseMediaId} from '@core/schema/ids';
import {useShow} from '@renderer/session/show';
import {useEffect, useMemo, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {MediaItem} from '@core/schema/mediaList';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {withPreferenceDefaults} from '@core/schema/preferences';
import type {Slide, SlidesItem} from '@core/services/slidesEdits';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {useSlidesVerseProjection} from '@renderer/features/bible/useSlidesVerseProjection';
import {Button} from '@renderer/ui/Button';
import {Picture} from '@renderer/rendering/pictures/Picture';
import {pictureSpec} from '@renderer/rendering/pictureSpec';
import {usePrepPictureSwitch} from '@renderer/rendering/PrepPictureSwitch';
import {
  previewAppearance,
  type PreviewRole,
} from '@renderer/features/songs/editor/songPreviewModel';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import {useItemSettings} from '../items/useItemSources';
import styles from './SlidesEditor.module.css';

export function slideBand(slide: Slide, media: readonly MediaItem[]): string {
  if (slide.label !== undefined) return slide.label;
  if ('verse' in slide) {
    const book = BIBLE_BOOKS.find(book => book.id === slide.verse.book);
    return `${book?.korean ?? '?깃꼍'} ${slide.verse.chapter}:${slide.verse.verse}`;
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
  const {
    background: _background,
    textOverrides: _overrides,
    ...item
  } = draftItem;
  return {
    ...item,
    ...(row.textOverrides === undefined
      ? {}
      : {textOverrides: row.textOverrides}),
    ...(parsed.ok ? {background: parsed.value} : {}),
  };
}

export function useSlidesAppearance(
  api: Pick<LlpApi, 'settings'>,
  item: SlidesItem,
  options: {
    readonly role?: PreviewRole;
    readonly screenId?: string | undefined;
  } = {},
) {
  const {role = 'audience', screenId} = options;
  const themes = useItemSettings(api.settings, 'themes');
  const screens = useItemSettings(api.settings, 'screens');
  const preferences = useItemSettings(
    api.settings,
    'preferences',
    role === 'stage',
  );
  const themeFile =
    themes.document?.name === 'themes' ? themes.document.value : undefined;
  const screenFile =
    screens.document?.name === 'screens' ? screens.document.value : undefined;
  const appearance = useMemo(
    () =>
      previewAppearance({
        role,
        screenId,
        themes: themeFile,
        screens: screenFile,
        stageLyricLabelPosition:
          preferences.document?.name === 'preferences'
            ? withPreferenceDefaults(preferences.document.value).output
                .stageLyricLabelPosition
            : undefined,
        item: {
          ...item,
          kind: item.slides.form,
          source: 'service',
          title: item.slides.name,
        },
      }),
    [role, screenId, themeFile, screenFile, item, preferences.document],
  );
  return {
    appearance,
    themes: themeFile,
    ready:
      (themes.document !== null || themes.failed) &&
      (screens.document !== null || screens.failed),
  };
}

export function SlidesCanvas({
  item,
  index,
  appearance,
  projection,
  part,
  outputSlide,
  eager = false,
}: {
  readonly item: SlidesItem;
  readonly index: number;
  readonly appearance: ReturnType<typeof previewAppearance>;
  readonly projection?: BibleProjection | null;
  readonly part?: number;
  readonly outputSlide?: import('@core/live/state').SlideLayer | null;
  readonly eager?: boolean;
}): JSX.Element {
  const spec = useMemo(
    () =>
      pictureSpec({
        kind: 'slides',
        item,
        index,
        projection,
        part,
        outputSlide,
        appearance,
      }).spec,
    [item, index, projection, part, outputSlide, appearance],
  );
  const host = useRef<HTMLDivElement>(null);
  const switching = usePrepPictureSwitch();
  const [visible, setVisible] = useState(
    switching === true || typeof IntersectionObserver === 'undefined',
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
    <div
      ref={host}
      className={styles.canvas}
      data-preview-ready={visible ? undefined : 'deferred'}
    >
      {eager || visible || switching === true ? (
        <Picture wait={switching === true} {...spec} />
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
    audience: useSlidesAppearance(api, item, {role: 'audience'}).appearance,
    stage: useSlidesAppearance(api, item, {role: 'stage'}).appearance,
    broadcast: useSlidesAppearance(api, item, {role: 'broadcast'}).appearance,
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
            ?댁쟾 遺遺?{' '}
          </Button>
          <span>
            {part + 1} / {count}
          </span>
          <Button
            disabled={part + 1 >= count}
            onClick={() => setChosenPart({id: slide.id, index: part + 1})}
          >
            ?ㅼ쓬 遺遺?{' '}
          </Button>
        </div>
      )}
    </RolePreview>
  );
}
