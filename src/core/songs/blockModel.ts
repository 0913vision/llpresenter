import {
  isGroupedSong,
  type AnySong,
  type GroupedSong,
  type SongGroup,
} from '../schema/groupedSong';

import type {SongGroupId} from '../schema/ids';

import type {SlideHotKey} from '../schema/slideHotKey';

import type {Song} from '../schema/song';

/** A zero-based source block and UTF-16 selection; it does not select output. */
export interface BlockSelection {
  readonly block: number;
  readonly start: number;
  readonly end: number;
}

/** A song and bounded editing selection, without persistence or session ownership. */
export interface BlockSnapshot<S extends AnySong = Song> {
  readonly song: S;
  readonly selection: BlockSelection;
  readonly mergeRefused?: boolean;
}

/** Locates a source slide inside its group, independently of arrangement order. */
export interface GroupedSlideAddress {
  readonly groupIndex: number;
  readonly groupId: SongGroupId;
  readonly groupName: string;
  readonly slideIndex: number;
  readonly isGroupStart: boolean;
  readonly slide: {
    readonly lines: readonly string[];
    readonly hotKey?: SlideHotKey;
  };
}

/** A flattened source-slide view; it does not change group identities or content. */
export interface EditorSlideItem {
  readonly lines: readonly string[];
  readonly label?: string | undefined;
  readonly isGroupStart?: boolean;
  readonly groupId?: SongGroupId;
  readonly slideIndex?: number;
  readonly hotKey?: SlideHotKey;
}

/** Describes one lyric edit, including Ctrl Enter split and Ctrl Shift N insert; it does not apply or persist it. */
export type BlockCommand =
  | {
      readonly type: 'text';
      readonly text: string;
      readonly start: number;
      readonly end: number;
    }
  | {readonly type: 'paste'; readonly text: string}
  | {
      readonly type: 'label';
      readonly name: string | undefined;
      readonly ids?: readonly [SongGroupId, SongGroupId];
    }
  | {readonly type: 'enter' | 'split' | 'insert' | 'merge'};

/** Normalizes line endings without trimming lyric text or changing blank lines. */
export const normalize = (text: string): string => text.replace(/\r\n?/g, '\n');

/** Matches blank-line block separators without matching nonblank lyric lines. */
export const BLANK_LINES = /\n(?:[^\S\n]*\n)+/g;

/** Splits normalized lyric text into lines without retaining an empty-text line. */
export const linesOf = (text: string): readonly string[] =>
  text === '' ? [] : text.split('\n');

/** Counts grouped source slides once, without expanding arrangement references. */
export function groupedSlideCount(song: GroupedSong): number {
  return song.groups.reduce((sum, group) => sum + group.slides.length, 0);
}

/** Counts source slides in either supported song format, independently of arrangements. */
export function slideCountOf(song: AnySong): number {
  return isGroupedSong(song) ? groupedSlideCount(song) : song.slides.length;
}

/** Locates a grouped source slide by flattened index without modifying the song. */
export function linearBlockAddress(
  song: GroupedSong,
  linearIndex: number,
): GroupedSlideAddress | undefined {
  let offset = 0;
  for (let groupIndex = 0; groupIndex < song.groups.length; groupIndex++) {
    const group = song.groups[groupIndex];
    if (group === undefined) continue;
    if (linearIndex < offset + group.slides.length) {
      const slideIndex = linearIndex - offset;
      const slide = group.slides[slideIndex];
      if (slide === undefined) return undefined;
      return {
        groupIndex,
        groupId: group.id,
        groupName: group.name,
        slideIndex,
        isGroupStart: slideIndex === 0,
        slide,
      };
    }
    offset += group.slides.length;
  }
  return undefined;
}

function groupSlidesOf(group: SongGroup): readonly EditorSlideItem[] {
  return group.slides.map((slide, index) => ({
    lines: slide.lines,
    ...(index === 0 && group.name !== '' ? {label: group.name} : {}),
    isGroupStart: index === 0,
    groupId: group.id,
    slideIndex: index,
    ...(slide.hotKey === undefined ? {} : {hotKey: slide.hotKey}),
  }));
}

/** Flattens source slides for editing without expanding arrangements or mutating groups. */
export function linearSlidesOf(song: AnySong): readonly EditorSlideItem[] {
  if (isGroupedSong(song)) {
    return song.groups.flatMap(groupSlidesOf);
  }
  return song.slides.map(slide => ({
    lines: slide.lines,
    ...(slide.label === undefined || slide.label === ''
      ? {}
      : {label: slide.label}),
    isGroupStart: true,
  }));
}

/** Bounds a source block and UTF-16 caret range without cloning or modifying the song. */
export function blockSnapshot<S extends AnySong = Song>(
  song: S,
  selection: BlockSelection = {block: 0, start: 0, end: 0},
  mergeRefused?: boolean,
): BlockSnapshot<S> {
  const count = slideCountOf(song);
  const block = Math.max(0, Math.min(Math.max(0, count - 1), selection.block));
  const slides = linearSlidesOf(song);
  const length = slides[block]?.lines.join('\n').length ?? 0;
  const start = Math.max(0, Math.min(length, selection.start));
  const end = Math.max(start, Math.min(length, selection.end));
  return {
    song,
    selection: {block, start, end},
    ...(mergeRefused ? {mergeRefused: true} : {}),
  };
}
