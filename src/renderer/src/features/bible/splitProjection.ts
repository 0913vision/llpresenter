import type {BibleSource} from '@core/bible/source';
import {bibleOutputLines} from '@core/bible/bibleTiles';
import {passageBook} from '@core/bible/adjacentVerses';
import {
  splitVerseParts,
  type VerseInput,
  type VersePart,
} from '@core/bible/split/splitVerses';
import type {BibleCutsFile} from '@core/schema/bibleCuts';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {BiblePartTransition} from '@core/schema/service';
import {biblePartEffect} from '@core/bible/partTransitions';
import {createScreenId, type ThemeId} from '@core/schema/ids';
import type {ThemeScreen} from '@core/themes/defaults';
import type {ThemesFile} from '@core/schema/themes';
import type {SlideTile} from '@core/presentation/model';
import {NO_LABEL_COLOR} from '@core/labels/colors';
import {SHOW_SERVICE_LIMITS} from '@core/schema/showService';
import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  bibleMeasure,
  type BibleTextElement,
  type BibleFontMeasure,
} from '@renderer/rendering/bibleMeasure';
import type {SplitLayout} from '@core/bible/split/layout';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import type {ShowView} from '@renderer/session/showStore';
import {projectSlidesBible} from './projectSlidesBible';
import type {RenderScreen, ThemeFrame} from '@renderer/rendering/layer';
import {bibleRefinements} from './BibleRefinements';

export interface SplitAppearance {
  readonly background?: string | undefined;
  readonly screen: RenderScreen;
  readonly theme: ThemeFrame;
}

interface SplitOptions {
  readonly background?: string;
  readonly transitions?: readonly BiblePartTransition[];
  readonly id: string;
  readonly verseNumbers: boolean;
  readonly reference: BiblePassage['reference'];
  readonly translationName: boolean;
  readonly source: 'service' | 'external';
  readonly review?: boolean;
  readonly theme?: ThemeId;
}

export type SplitSource = SplitOptions &
  (
    | {readonly kind: 'bible'; readonly passage: BibleLookupPassage}
    | {readonly kind: 'slides'; readonly input: readonly SlideTile[]}
  );

export function sourceContent(source: SplitSource): object {
  return source.kind === 'bible' ? source.passage : source.input;
}

export interface ProjectionLayout {
  readonly refined?:
    | ((verse: VerseInput, prefix: string) => readonly number[] | undefined)
    | undefined;
  readonly element: BibleTextElement;
  readonly layout: SplitLayout;
  readonly saved?: BibleCutsFile | undefined;
}

export interface BibleProjection {
  readonly appearance?: SplitAppearance;
  readonly source: SplitSource;
  readonly element: BibleTextElement;
  readonly layout: SplitLayout;
  readonly verses: readonly VerseInput[];
  readonly parts: readonly VersePart[];
  readonly partsByTile: ReadonlyArray<VersePart | null>;
  readonly numbered: boolean;
  readonly tiles: readonly SlideTile[];
  readonly problem?: 'tile-limit';
}

const defaultScreens: readonly ThemeScreen[] = [
  {
    id: createScreenId(STARTER_SCREEN_IDS.main),
    kind: 'audience',
    method: 'fullscreen',
  },
  {
    id: createScreenId(STARTER_SCREEN_IDS.broadcast),
    kind: 'broadcast',
    method: 'capture',
  },
  {
    id: createScreenId(STARTER_SCREEN_IDS.stage),
    kind: 'stage',
    method: 'fullscreen',
  },
];
const CACHE_LIMIT = 32;

export function splitSourceFor(
  view: ShowView,
  itemId: string,
): SplitSource | null {
  const external: BibleSource | null = bibleSourceFor(view, itemId);
  if (external !== null) {
    return {
      id: itemId,
      kind: 'bible',
      passage: external.passage,
      verseNumbers: external.verseNumbers,
      reference: external.reference,
      translationName: external.translationName ?? false,
      source: 'external',
      review: external.review !== false,
    };
  }
  const row = view.rows.find(row => row.id === itemId);
  if (row?.kind === 'slides' && row.form === 'blank') {
    const input = view.tiles[itemId];
    if (!input?.some(tile => tile.verse !== undefined)) {
      return null;
    }
    return {
      id: itemId,
      kind: 'slides',
      input,
      source: 'service',
      verseNumbers: true,
      reference: 'every',
      translationName: false,
      ...(row.theme === undefined ? {} : {theme: row.theme}),
      ...(row.background === undefined
        ? {}
        : {background: row.background.mediaId}),
    };
  }
  if (row?.kind !== 'bible' || row.bible?.passage === undefined) return null;
  return {
    id: itemId,
    kind: 'bible',
    passage: row.bible.passage,
    verseNumbers: row.bible.verseNumbers ?? true,
    reference: row.bible.reference ?? 'every',
    translationName: row.bible.translationName ?? false,
    ...(row.bible.transitions === undefined
      ? {}
      : {transitions: row.bible.transitions}),
    source: 'service',
    ...(row.bible.theme === undefined ? {} : {theme: row.bible.theme}),
  };
}

export function projectBible(
  source: SplitSource,
  {element, layout, saved, refined}: ProjectionLayout,
): BibleProjection | null {
  if (source.kind === 'slides') {
    return projectSlidesBible(source, {element, layout, saved, refined});
  }
  const book = passageBook(source.passage);
  if (book === undefined) return null;
  const capped: BibleProjection = {
    source,
    element,
    layout,
    verses: [],
    parts: [],
    partsByTile: [],
    numbered: source.verseNumbers && source.passage.verses.length > 1,
    tiles: [],
    problem: 'tile-limit',
  };
  if (source.passage.verses.length > SHOW_SERVICE_LIMITS.tiles) return capped;
  const verses = source.passage.verses.map(verse => ({
    reference: {
      translation: source.passage.translation,
      book: book.id,
      chapter: verse.chapter,
      verse: verse.verse,
    },
    text: verse.text,
  }));
  const parts: VersePart[] = [];
  for (const verse of verses) {
    const prefix =
      source.verseNumbers && verses.length > 1
        ? `${verse.reference.verse} `
        : '';
    const next = splitVerseParts(verse, layout, {
      saved,
      prefix,
      refined: refined?.(verse, prefix),
    });
    if (parts.length + next.length > SHOW_SERVICE_LIMITS.tiles) return capped;
    parts.push(...next);
  }
  const name = source.passage.displayRef.replace(/\s+\d.*$/u, '');
  const translation =
    source.translationName && source.passage.translationLabel
      ? ` (${source.passage.translationLabel})`
      : '';
  const tiles = parts.map((part, index): SlideTile => {
    const prefix =
      source.verseNumbers && verses.length > 1 && part.part === 1
        ? `${part.reference.verse} `
        : '';
    const reference = `${name} ${part.reference.chapter}:${part.reference.verse}${translation}`;
    return {
      label: `${book.koreanShort}${part.reference.chapter}:${part.reference.verse}${part.partCount > 1 ? ` (${part.part})` : ''}`,
      labelColor: NO_LABEL_COLOR,
      lines: part.lines ?? bibleOutputLines(prefix + part.display),
      continued: part.continued,
      biblePart: part.part,
      ...(() => {
        const transition = biblePartEffect(
          source.transitions,
          part.reference,
          part.part,
        );
        return transition === undefined ? {} : {transition};
      })(),
      ...(source.reference === 'every' ||
      (source.reference === 'first' && index === 0) ||
      (source.reference === 'last' && index === parts.length - 1)
        ? {reference}
        : {}),
    };
  });
  return {
    source,
    element,
    layout,
    verses,
    parts,
    partsByTile: parts,
    tiles,
    numbered: source.verseNumbers && verses.length > 1,
  };
}

/** Owns only a bounded cache of derived projections; changing settings replaces it. */
export class BibleProjections {
  private readonly cache = new Map<string, BibleProjection>();
  private refinementRevision = bibleRefinements.getSnapshot();
  constructor(
    private readonly context: {
      readonly themes: ThemesFile | null;
      readonly screens: readonly ThemeScreen[] | undefined;
      readonly saved: BibleCutsFile | undefined;
      readonly canvas: BibleFontMeasure;
    },
  ) {}

  get(
    source: SplitSource,
    revision = bibleRefinements.getSnapshot(),
  ): BibleProjection | null {
    if (this.refinementRevision !== revision) {
      this.refinementRevision = revision;
      this.cache.clear();
    }
    const cached = this.cache.get(source.id);
    if (
      cached !== undefined &&
      sourceContent(cached.source) === sourceContent(source) &&
      cached.source.theme === source.theme &&
      cached.source.background === source.background &&
      cached.source.verseNumbers === source.verseNumbers &&
      cached.source.reference === source.reference &&
      cached.source.translationName === source.translationName &&
      cached.source.transitions === source.transitions &&
      cached.source.review === source.review
    ) {
      return cached;
    }
    const screens = this.context.screens ?? defaultScreens;
    const screen =
      screens.find(screen => screen.kind === 'audience') ?? screens[0];
    if (screen === undefined) return null;
    const theme = resolveItemTheme({
      file: this.context.themes,
      kind: source.kind === 'slides' ? 'blank' : 'bible',
      source: source.source,
      screens,
      ...(source.theme === undefined ? {} : {theme: source.theme}),
    });
    const resolved = resolveThemeScreen(theme, screen.id, screens);
    const element = resolved.layout.elements.find(
      (element): element is BibleTextElement => element.kind === 'currentText',
    );
    if (element === undefined) return null;
    const projected = projectBible(source, {
      element,
      layout: bibleMeasure(element, this.context.canvas),
      saved: this.context.saved,
      refined:
        source.review === false
          ? undefined
          : (verse, prefix) => bibleRefinements.get(verse, element, prefix),
    });
    if (projected === null) return null;
    const projection: BibleProjection = {
      ...projected,
      appearance: {
        background: source.background,
        screen,
        theme: {
          ...resolved,
          emptyColor:
            'emptyColor' in screen && typeof screen.emptyColor === 'string'
              ? screen.emptyColor
              : '#000000',
          themeId: theme.id,
          revision: 0,
          missing: [],
          item: {
            id: source.id,
            kind: source.kind === 'slides' ? 'blank' : 'bible',
            source: source.source,
            ...(source.kind === 'bible'
              ? {title: source.passage.displayRef}
              : {}),
          },
        },
      },
    };
    if (this.cache.size >= CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(source.id, projection);
    return projection;
  }
}
